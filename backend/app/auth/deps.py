from typing import Annotated

from beanie import PydanticObjectId
from bson.errors import InvalidId
from fastapi import Cookie, Depends, HTTPException, status

from app.auth.session import COOKIE_NAME, read_session_token
from app.config import Settings, get_settings
from app.models import User

SettingsDep = Annotated[Settings, Depends(get_settings)]


async def user_from_session(token: str | None, settings: Settings) -> User | None:
    """L'utente del cookie di sessione, oppure None (serve anche al WebSocket della lotteria)."""
    if not token:
        return None
    user_id = read_session_token(token, settings)
    if not user_id:
        return None
    try:
        return await User.get(PydanticObjectId(user_id))
    except InvalidId:
        return None


async def current_user(
    settings: SettingsDep,
    session: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
) -> User:
    user = await user_from_session(session, settings)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Serve fare l'accesso.")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
