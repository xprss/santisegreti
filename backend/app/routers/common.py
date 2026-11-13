from beanie import PydanticObjectId
from fastapi import HTTPException, status

from app.models import Room, RoomStatus, User

ROOM_NOT_FOUND = "Questa stanza non esiste, oppure non ne fai parte."


async def load_room_for_member(room_id: PydanticObjectId, user: User) -> Room:
    room = await Room.get(room_id)
    # Stessa risposta se la stanza non esiste o se l'utente non ne fa parte:
    # chi non è invitato non deve poter scoprire quali stanze esistono.
    if room is None or user.id not in room.participant_ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND, ROOM_NOT_FOUND)
    return room


async def load_room_for_admin(room_id: PydanticObjectId, user: User) -> Room:
    room = await load_room_for_member(room_id, user)
    if room.admin_id != user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Questa operazione è riservata all'admin della stanza."
        )
    return room


def ensure_open(room: Room, detail: str) -> None:
    if room.status != RoomStatus.OPEN:
        raise HTTPException(status.HTTP_409_CONFLICT, detail)
