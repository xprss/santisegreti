from beanie import PydanticObjectId
from fastapi import APIRouter, HTTPException, status

from app.auth.deps import CurrentUser
from app.models import ExclusionGroup, Room
from app.routers.common import ensure_open, load_room_for_admin
from app.schemas import ExclusionGroupIn, ExclusionGroupOut

router = APIRouter(prefix="/rooms/{room_id}/exclusions", tags=["exclusions"])

_LOCKED = "L'estrazione è già fatta: per cambiare le esclusioni serve prima annullarla."


def _validated_members(room: Room, body: ExclusionGroupIn) -> list[PydanticObjectId]:
    members = list(dict.fromkeys(body.member_ids))
    if len(members) < 2:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Un gruppo ha senso con almeno due persone."
        )
    outsiders = [m for m in members if m not in room.participant_ids]
    if outsiders:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Nel gruppo c'è qualcuno che non fa parte della stanza.",
        )
    return members


def _find_group(room: Room, group_id: str) -> ExclusionGroup:
    for group in room.exclusion_groups:
        if group.id == group_id:
            return group
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Questo gruppo non esiste più.")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_group(
    room_id: PydanticObjectId, body: ExclusionGroupIn, user: CurrentUser
) -> ExclusionGroupOut:
    room = await load_room_for_admin(room_id, user)
    ensure_open(room, _LOCKED)
    group = ExclusionGroup(name=body.name, member_ids=_validated_members(room, body))
    room.exclusion_groups.append(group)
    await room.save()
    return ExclusionGroupOut(**group.model_dump())


@router.put("/{group_id}")
async def update_group(
    room_id: PydanticObjectId, group_id: str, body: ExclusionGroupIn, user: CurrentUser
) -> ExclusionGroupOut:
    room = await load_room_for_admin(room_id, user)
    ensure_open(room, _LOCKED)
    group = _find_group(room, group_id)
    group.name = body.name
    group.member_ids = _validated_members(room, body)
    await room.save()
    return ExclusionGroupOut(**group.model_dump())


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(room_id: PydanticObjectId, group_id: str, user: CurrentUser) -> None:
    room = await load_room_for_admin(room_id, user)
    ensure_open(room, _LOCKED)
    _find_group(room, group_id)
    room.exclusion_groups = [g for g in room.exclusion_groups if g.id != group_id]
    await room.save()
