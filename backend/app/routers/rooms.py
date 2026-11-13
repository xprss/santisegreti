from beanie import PydanticObjectId
from beanie.operators import In
from fastapi import APIRouter, HTTPException, status

from app.auth.deps import CurrentUser
from app.models import Assignment, Invite, Room, User
from app.routers.common import ensure_open, load_room_for_admin, load_room_for_member
from app.schemas import (
    ExclusionGroupOut,
    RoomCreate,
    RoomDetail,
    RoomSummary,
    RoomUpdate,
    UserPublic,
)

router = APIRouter(prefix="/rooms", tags=["rooms"])


async def room_detail(room: Room, user: User) -> RoomDetail:
    users = await User.find(In(User.id, room.participant_ids)).to_list()
    by_id = {u.id: u for u in users}
    # L'ordine di ingresso nella stanza è anche l'ordine in cui gli omini compaiono nella scena.
    participants = [UserPublic.of(by_id[pid]) for pid in room.participant_ids if pid in by_id]
    is_admin = room.admin_id == user.id
    groups = (
        [ExclusionGroupOut(**g.model_dump()) for g in room.exclusion_groups] if is_admin else []
    )
    return RoomDetail(
        **RoomSummary.of(room, user).model_dump(),
        admin_id=room.admin_id,
        drawn_at=room.drawn_at,
        participants=participants,
        exclusion_groups=groups,
    )


@router.get("")
async def list_rooms(user: CurrentUser) -> list[RoomSummary]:
    rooms = await Room.find(Room.participant_ids == user.id).sort(-Room.created_at).to_list()
    return [RoomSummary.of(r, user) for r in rooms]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_room(body: RoomCreate, user: CurrentUser) -> RoomDetail:
    room = Room(
        name=body.name,
        theme=body.theme or None,
        budget_eur=body.budget_eur,
        exchange_date=body.exchange_date,
        admin_id=user.id,
        participant_ids=[user.id],
    )
    await room.insert()
    return await room_detail(room, user)


@router.get("/{room_id}")
async def get_room(room_id: PydanticObjectId, user: CurrentUser) -> RoomDetail:
    room = await load_room_for_member(room_id, user)
    return await room_detail(room, user)


@router.patch("/{room_id}")
async def update_room(room_id: PydanticObjectId, body: RoomUpdate, user: CurrentUser) -> RoomDetail:
    room = await load_room_for_admin(room_id, user)
    changes = body.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is None:
        del changes["name"]
    if "budget_eur" in changes and changes["budget_eur"] is None:
        del changes["budget_eur"]
    if "theme" in changes:
        changes["theme"] = changes["theme"] or None
    for field, value in changes.items():
        setattr(room, field, value)
    await room.save()
    return await room_detail(room, user)


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(room_id: PydanticObjectId, user: CurrentUser) -> None:
    room = await load_room_for_admin(room_id, user)
    await Assignment.find(Assignment.room_id == room.id).delete()
    await Invite.find(Invite.room_id == room.id).delete()
    await room.delete()


@router.delete("/{room_id}/participants/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_participant(
    room_id: PydanticObjectId, user_id: PydanticObjectId, user: CurrentUser
) -> None:
    room = await load_room_for_member(room_id, user)
    if user_id == room.admin_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "L'admin resta nella stanza fino alla fine. Se serve, la stanza si può eliminare.",
        )
    if user.id not in (user_id, room.admin_id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Solo l'admin può far uscire qualcun altro dalla stanza."
        )
    if user_id not in room.participant_ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Questa persona non è nella stanza.")
    ensure_open(
        room,
        "L'estrazione è già stata fatta: per far uscire qualcuno serve prima annullarla.",
    )

    room.participant_ids = [pid for pid in room.participant_ids if pid != user_id]
    groups = []
    for group in room.exclusion_groups:
        group.member_ids = [mid for mid in group.member_ids if mid != user_id]
        if len(group.member_ids) >= 2:
            groups.append(group)
    room.exclusion_groups = groups
    await room.save()
