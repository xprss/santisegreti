from fastapi import APIRouter, HTTPException, status

from app.auth.deps import CurrentUser
from app.models.accessories import SPECIAL_ACCESSORIES
from app.schemas import Me, MeUpdate

router = APIRouter(prefix="/me", tags=["me"])


@router.get("")
async def get_me(user: CurrentUser) -> Me:
    return Me.of(user)


@router.patch("")
async def update_me(body: MeUpdate, user: CurrentUser) -> Me:
    changes = body.model_dump(exclude_unset=True)
    # null ha senso solo per l'accessorio (lo toglie); per gli altri campi vuol dire "non cambiare".
    changes = {k: v for k, v in changes.items() if v is not None or k == "accessory"}
    if "color" in changes:
        changes["color"] = changes["color"].upper()
    accessory = changes.get("accessory")
    if accessory in SPECIAL_ACCESSORIES and accessory not in user.unlocked_accessories():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Questo accessorio si vince alla lotteria.")
    for field, value in changes.items():
        setattr(user, field, value)
    if changes:
        await user.save()
    return Me.of(user)
