from fastapi import APIRouter

from app.auth.deps import CurrentUser
from app.schemas import Me, MeUpdate

router = APIRouter(prefix="/me", tags=["me"])


@router.get("")
async def get_me(user: CurrentUser) -> Me:
    return Me.of(user)


@router.patch("")
async def update_me(body: MeUpdate, user: CurrentUser) -> Me:
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if "color" in changes:
        changes["color"] = changes["color"].upper()
    for field, value in changes.items():
        setattr(user, field, value)
    if changes:
        await user.save()
    return Me.of(user)
