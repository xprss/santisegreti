from typing import Annotated

from beanie import PydanticObjectId
from bson.errors import InvalidId
from fastapi import Cookie, Depends, HTTPException, status

from app.auth.session import COOKIE_NAME, read_session_token
from app.config import Settings, get_settings
from app.models import User

SettingsDep = Annotated[Settings, Depends(get_settings)]


async def current_user(
    settings: SettingsDep,
    session: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Serve fare l'accesso.")
    if not session:
        raise unauthorized
    user_id = read_session_token(session, settings)
    if not user_id:
        raise unauthorized
    try:
        user = await User.get(PydanticObjectId(user_id))
    except InvalidId:
        user = None
    if user is None:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(current_user)]
