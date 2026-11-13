from datetime import timedelta

from beanie import PydanticObjectId
from fastapi import APIRouter, HTTPException, status

from app.auth.deps import CurrentUser, SettingsDep
from app.models import Invite, Room, RoomStatus
from app.models.user import utcnow
from app.routers.common import ensure_open, load_room_for_admin
from app.schemas import InviteOut, RedeemIn, RedeemOut
from app.services.otp import generate_code, hash_code, normalize_code, redeem_limiter

router = APIRouter(tags=["invites"])

_DRAWN_MESSAGE = (
    "In questa stanza l'estrazione è già stata fatta, quindi per ora non si entra. "
    "Se l'admin la annulla, il codice nuovo funzionerà."
)


@router.post("/rooms/{room_id}/invites", status_code=status.HTTP_201_CREATED)
async def create_invite(
    room_id: PydanticObjectId, user: CurrentUser, settings: SettingsDep
) -> InviteOut:
    room = await load_room_for_admin(room_id, user)
    ensure_open(
        room, "L'estrazione è già fatta: per invitare qualcun altro serve prima annullarla."
    )

    now = utcnow()
    for _ in range(5):
        code = generate_code()
        code_hash = hash_code(code)
        clash = await Invite.find_one(
            Invite.code_hash == code_hash,
            Invite.used_by == None,  # noqa: E711 (operatore Beanie, non confronto Python)
            Invite.expires_at > now,
        )
        if clash is None:
            break
    else:  # pragma: no cover - 887 milioni di combinazioni, cinque collisioni di fila non capitano
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Riproviamo tra un attimo?")

    invite = Invite(
        room_id=room.id,
        code_hash=code_hash,
        expires_at=now + timedelta(seconds=settings.invite_ttl_seconds),
        created_by=user.id,
    )
    await invite.insert()
    return InviteOut(
        code=code, expires_at=invite.expires_at, expires_in=settings.invite_ttl_seconds
    )


@router.post("/invites/redeem")
async def redeem_invite(body: RedeemIn, user: CurrentUser) -> RedeemOut:
    limiter_key = str(user.id)
    if redeem_limiter.is_blocked(limiter_key):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Un po' troppi tentativi di fila. Facciamo una pausa di qualche minuto?",
        )

    now = utcnow()
    code_hash = hash_code(normalize_code(body.code))
    invite = (
        await Invite.find(Invite.code_hash == code_hash).sort(-Invite.created_at).first_or_none()
    )
    if invite is None:
        redeem_limiter.record_failure(limiter_key)
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Questo codice non lo troviamo. Vale la pena ricontrollarlo: i codici durano 3 minuti.",
        )

    room = await Room.get(invite.room_id)
    if room is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La stanza di questo invito non c'è più.")
    if user.id in room.participant_ids:
        return RedeemOut(room_id=room.id, already_member=True)

    if invite.used_by is not None:
        raise HTTPException(
            status.HTTP_410_GONE,
            "Questo codice è già stato usato. Serve un codice nuovo dall'admin della stanza.",
        )
    if invite.expires_at <= now:
        raise HTTPException(
            status.HTTP_410_GONE,
            "Questo codice è scaduto (dura 3 minuti). "
            "Serve un codice nuovo dall'admin della stanza.",
        )
    if room.status != RoomStatus.OPEN:
        raise HTTPException(status.HTTP_409_CONFLICT, _DRAWN_MESSAGE)

    # Riscatto atomico: due persone con lo stesso codice nello stesso istante, entra solo una.
    claimed = await Invite.get_pymongo_collection().update_one(
        {"_id": invite.id, "used_by": None, "expires_at": {"$gt": now}},
        {"$set": {"used_by": user.id}},
    )
    if claimed.modified_count == 0:
        raise HTTPException(
            status.HTTP_410_GONE,
            "Questo codice è appena stato usato. Serve un codice nuovo dall'admin della stanza.",
        )

    joined = await Room.get_pymongo_collection().update_one(
        {"_id": room.id, "status": RoomStatus.OPEN.value},
        {"$addToSet": {"participant_ids": user.id}},
    )
    if joined.matched_count == 0:
        await Invite.get_pymongo_collection().update_one(
            {"_id": invite.id}, {"$set": {"used_by": None}}
        )
        raise HTTPException(status.HTTP_409_CONFLICT, _DRAWN_MESSAGE)

    redeem_limiter.reset(limiter_key)
    return RedeemOut(room_id=room.id, already_member=False)
