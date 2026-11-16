import secrets
from datetime import timedelta

from beanie import PydanticObjectId
from fastapi import APIRouter, HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.auth.deps import CurrentUser, SettingsDep
from app.models import Lottery, LotteryStatus, Room, Ticket, User
from app.models.user import utcnow
from app.routers.common import load_room_for_admin, load_room_for_member
from app.schemas import LotteryOut
from app.services.lottery import MIN_TICKETS, lottery_for, new_ticket_number
from app.services.lottery_hub import LotteryHubDep

router = APIRouter(prefix="/rooms/{room_id}/lottery", tags=["lottery"])

NO_LOTTERY = "In questa stanza non c'è una lotteria."
ALREADY_DRAWN = "La lotteria è già stata estratta: ormai è fatta."


async def find_lottery(room: Room, user: User) -> Lottery:
    lottery = await Lottery.find_one(Lottery.room_id == room.id)
    # La bozza la vede solo l'admin: per gli altri è come se non ci fosse.
    if lottery is None or (lottery.status == LotteryStatus.DRAFT and user.id != room.admin_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_LOTTERY)
    return lottery


async def lottery_out(room: Room, user: User) -> LotteryOut:
    view = await lottery_for(room, user)
    if view is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_LOTTERY)
    return view


@router.get("")
async def get_lottery(room_id: PydanticObjectId, user: CurrentUser) -> LotteryOut | None:
    room = await load_room_for_member(room_id, user)
    return await lottery_for(room, user)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_lottery(
    room_id: PydanticObjectId, user: CurrentUser, hub: LotteryHubDep
) -> LotteryOut:
    room = await load_room_for_admin(room_id, user)
    try:
        await Lottery(room_id=room.id).insert()
    except DuplicateKeyError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "In questa stanza c'è già una lotteria: se ne fa una sola."
        ) from exc
    await hub.broadcast_lottery(room.id)
    return await lottery_out(room, user)


@router.post("/open")
async def open_lottery(
    room_id: PydanticObjectId, user: CurrentUser, hub: LotteryHubDep
) -> LotteryOut:
    room = await load_room_for_admin(room_id, user)
    opened = await Lottery.get_pymongo_collection().update_one(
        {"room_id": room.id, "status": LotteryStatus.DRAFT.value},
        {"$set": {"status": LotteryStatus.OPEN.value, "opened_at": utcnow()}},
    )
    if opened.modified_count == 0:
        lottery = await find_lottery(room, user)
        detail = "La lotteria è già aperta." if lottery.status == "open" else ALREADY_DRAWN
        raise HTTPException(status.HTTP_409_CONFLICT, detail)
    await hub.broadcast_lottery(room.id)
    return await lottery_out(room, user)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lottery(room_id: PydanticObjectId, user: CurrentUser, hub: LotteryHubDep) -> None:
    room = await load_room_for_admin(room_id, user)
    # Si annulla solo prima dell'estrazione: dopo, il premio è di chi l'ha vinto.
    deleted = await Lottery.get_pymongo_collection().delete_one(
        {
            "room_id": room.id,
            "status": {"$in": [LotteryStatus.DRAFT.value, LotteryStatus.OPEN.value]},
        }
    )
    if deleted.deleted_count == 0:
        await find_lottery(room, user)
        raise HTTPException(status.HTTP_409_CONFLICT, ALREADY_DRAWN)
    await hub.broadcast_lottery(room.id)


@router.post("/tickets", status_code=status.HTTP_201_CREATED)
async def take_ticket(
    room_id: PydanticObjectId, user: CurrentUser, hub: LotteryHubDep
) -> LotteryOut:
    room = await load_room_for_member(room_id, user)
    lottery = await find_lottery(room, user)

    # Update condizionale: un doppio tocco non stampa due biglietti, e i numeri non si ripetono.
    for _ in range(5):
        if lottery.status == LotteryStatus.DRAFT:
            raise HTTPException(status.HTTP_409_CONFLICT, "La lotteria non è ancora aperta.")
        if lottery.status != LotteryStatus.OPEN:
            raise HTTPException(status.HTTP_409_CONFLICT, "Troppo tardi: l'estrazione è partita.")
        if any(t.user_id == user.id for t in lottery.tickets):
            raise HTTPException(status.HTTP_409_CONFLICT, "Hai già il tuo biglietto.")

        ticket = Ticket(user_id=user.id, number=new_ticket_number())
        pushed = await Lottery.get_pymongo_collection().update_one(
            {
                "_id": lottery.id,
                "status": LotteryStatus.OPEN.value,
                "tickets.user_id": {"$ne": user.id},
                "tickets.number": {"$ne": ticket.number},
            },
            {"$push": {"tickets": ticket.model_dump()}},
        )
        if pushed.modified_count:
            break
        lottery = await find_lottery(room, user)
    else:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "La macchinetta si è inceppata: riprova."
        )

    await hub.broadcast_lottery(room.id)
    return await lottery_out(room, user)


@router.post("/draw")
async def draw_lottery(
    room_id: PydanticObjectId, user: CurrentUser, hub: LotteryHubDep, settings: SettingsDep
) -> LotteryOut:
    room = await load_room_for_admin(room_id, user)
    lottery = await find_lottery(room, user)

    for _ in range(3):
        if lottery.status == LotteryStatus.DRAFT:
            raise HTTPException(status.HTTP_409_CONFLICT, "Prima va aperta ai partecipanti.")
        if lottery.status == LotteryStatus.DRAWN:
            raise HTTPException(status.HTTP_409_CONFLICT, ALREADY_DRAWN)
        members = set(room.participant_ids)
        tickets = [t for t in lottery.tickets if t.user_id in members]
        if len(tickets) < MIN_TICKETS:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f"Per estrarre servono almeno {MIN_TICKETS} biglietti.",
            )

        winner = secrets.choice(tickets)
        now = utcnow()
        reveal_at = now + timedelta(seconds=settings.lottery_countdown_seconds)
        # Il vincitore si decide adesso e resta sul server fino a `reveal_at`. La condizione
        # sul numero di biglietti evita di estrarre da un elenco cambiato nel frattempo.
        locked = await Lottery.get_pymongo_collection().update_one(
            {
                "_id": lottery.id,
                "status": LotteryStatus.OPEN.value,
                "tickets": {"$size": len(lottery.tickets)},
            },
            {
                "$set": {
                    "status": LotteryStatus.DRAWN.value,
                    "drawn_at": now,
                    "reveal_at": reveal_at,
                    "winner_user_id": winner.user_id,
                    "winner_number": winner.number,
                }
            },
        )
        if locked.modified_count:
            break
        lottery = await find_lottery(room, user)
    else:
        raise HTTPException(status.HTTP_409_CONFLICT, "I biglietti stanno cambiando: riprova.")

    # Lo sblocco vale da `reveal_at`: prima non compare nemmeno nel profilo del vincitore.
    await User.get_pymongo_collection().update_one(
        {"_id": winner.user_id},
        {"$push": {"unlocks": {"accessory": lottery.prize.value, "available_from": reveal_at}}},
    )
    hub.schedule_reveal(room.id, reveal_at)
    await hub.broadcast_lottery(room.id)
    return await lottery_out(room, user)
