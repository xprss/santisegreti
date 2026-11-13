from beanie import PydanticObjectId
from fastapi import APIRouter, HTTPException, status

from app.auth.deps import CurrentUser
from app.models import Assignment, RoomStatus, User
from app.models.user import utcnow
from app.routers.common import load_room_for_admin, load_room_for_member
from app.routers.rooms import room_detail
from app.schemas import MyAssignment, RoomDetail, UserPublic
from app.services.matching import MatchingError, draw

router = APIRouter(prefix="/rooms/{room_id}", tags=["draw"])


@router.post("/draw")
async def run_draw(room_id: PydanticObjectId, user: CurrentUser) -> RoomDetail:
    room = await load_room_for_admin(room_id, user)
    if room.status != RoomStatus.OPEN:
        raise HTTPException(status.HTTP_409_CONFLICT, "L'estrazione è già stata fatta.")

    participants = set(room.participant_ids)
    groups = [[m for m in g.member_ids if m in participants] for g in room.exclusion_groups]
    try:
        pairs = draw(room.participant_ids, groups)
    except MatchingError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc

    # Il cambio di stato è condizionale: un doppio click non produce due estrazioni.
    now = utcnow()
    locked = await room.get_pymongo_collection().update_one(
        {"_id": room.id, "status": RoomStatus.OPEN.value},
        {"$set": {"status": RoomStatus.DRAWN.value, "drawn_at": now}},
    )
    if locked.modified_count == 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "L'estrazione è già stata fatta.")

    try:
        await Assignment.find(Assignment.room_id == room.id).delete()
        await Assignment.insert_many(
            [Assignment(room_id=room.id, giver_id=g, receiver_id=r) for g, r in pairs.items()]
        )
    except Exception:
        await room.get_pymongo_collection().update_one(
            {"_id": room.id}, {"$set": {"status": RoomStatus.OPEN.value, "drawn_at": None}}
        )
        raise

    room.status = RoomStatus.DRAWN
    room.drawn_at = now
    return await room_detail(room, user)


@router.delete("/draw")
async def cancel_draw(room_id: PydanticObjectId, user: CurrentUser) -> RoomDetail:
    room = await load_room_for_admin(room_id, user)
    if room.status != RoomStatus.DRAWN:
        raise HTTPException(status.HTTP_409_CONFLICT, "Non c'è nessuna estrazione da annullare.")
    await Assignment.find(Assignment.room_id == room.id).delete()
    room.status = RoomStatus.OPEN
    room.drawn_at = None
    await room.save()
    return await room_detail(room, user)


@router.get("/my-assignment")
async def my_assignment(room_id: PydanticObjectId, user: CurrentUser) -> MyAssignment:
    room = await load_room_for_member(room_id, user)
    if room.status != RoomStatus.DRAWN:
        return MyAssignment(receiver=None)
    assignment = await Assignment.find_one(
        Assignment.room_id == room.id, Assignment.giver_id == user.id
    )
    if assignment is None:
        return MyAssignment(receiver=None)
    receiver = await User.get(assignment.receiver_id)
    return MyAssignment(receiver=UserPublic.of(receiver) if receiver else None)
