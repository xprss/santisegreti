"""Come appare una lotteria a ciascun partecipante (REST e WebSocket usano la stessa vista)."""

import secrets
from datetime import datetime

from beanie import PydanticObjectId

from app.models import Lottery, LotteryStatus, Room, User
from app.models.user import utcnow
from app.schemas import LotteryOut, LotteryPhase, LotteryWinner, TicketOut, UserPublic

TICKET_PREFIX = "SANTO-"
MIN_TICKETS = 2


def new_ticket_number() -> str:
    return f"{TICKET_PREFIX}{secrets.randbelow(10**6):06d}"


def lottery_phase(lottery: Lottery, now: datetime) -> LotteryPhase:
    if lottery.status == LotteryStatus.DRAWN:
        return "countdown" if lottery.reveal_at and now < lottery.reveal_at else "drawn"
    return lottery.status.value  # type: ignore[return-value]


async def load_winner(lottery: Lottery, now: datetime) -> User | None:
    """Il vincitore, ma solo a countdown finito: prima resta un segreto del server."""
    if lottery_phase(lottery, now) != "drawn" or lottery.winner_user_id is None:
        return None
    return await User.get(lottery.winner_user_id)


def lottery_view(
    lottery: Lottery | None,
    room: Room,
    user_id: PydanticObjectId,
    now: datetime,
    winner: User | None,
) -> LotteryOut | None:
    if lottery is None:
        return None
    if lottery.status == LotteryStatus.DRAFT and user_id != room.admin_id:
        return None

    phase = lottery_phase(lottery, now)
    members = set(room.participant_ids)
    holders = [t.user_id for t in lottery.tickets if t.user_id in members]
    mine = next((t for t in lottery.tickets if t.user_id == user_id), None)
    countdown_ms = None
    if phase == "countdown" and lottery.reveal_at:
        countdown_ms = max(0, int((lottery.reveal_at - now).total_seconds() * 1000))
    shown_winner = None
    if phase == "drawn" and winner is not None and lottery.winner_number:
        shown_winner = LotteryWinner(user=UserPublic.of(winner), number=lottery.winner_number)

    return LotteryOut(
        status=phase,
        prize=lottery.prize,
        ticket_count=len(holders),
        ticket_holder_ids=holders,
        my_ticket=TicketOut(number=mine.number, taken_at=mine.taken_at) if mine else None,
        countdown_ms=countdown_ms,
        winner=shown_winner,
        opened_at=lottery.opened_at,
        drawn_at=lottery.drawn_at if phase == "drawn" else None,
    )


async def lottery_for(room: Room, user: User) -> LotteryOut | None:
    now = utcnow()
    lottery = await Lottery.find_one(Lottery.room_id == room.id)
    winner = await load_winner(lottery, now) if lottery else None
    return lottery_view(lottery, room, user.id, now, winner)
