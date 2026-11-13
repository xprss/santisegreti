from datetime import timedelta

import jwt
from fastapi import Response

from app.config import Settings
from app.models.user import utcnow

COOKIE_NAME = "ss_session"
ALGORITHM = "HS256"


def create_session_token(user_id: str, settings: Settings) -> str:
    now = utcnow()
    payload = {"sub": user_id, "iat": now, "exp": now + timedelta(days=settings.session_days)}
    return jwt.encode(payload, settings.session_secret, algorithm=ALGORITHM)


def read_session_token(token: str, settings: Settings) -> str | None:
    try:
        payload = jwt.decode(token, settings.session_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    sub = payload.get("sub")
    return sub if isinstance(sub, str) else None


def set_session_cookie(response: Response, user_id: str, settings: Settings) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_session_token(user_id, settings),
        max_age=settings.session_days * 24 * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        COOKIE_NAME, httponly=True, secure=settings.cookie_secure, samesite="lax", path="/"
    )
