from fastapi import APIRouter, HTTPException, Response, status

from app.auth.deps import SettingsDep
from app.auth.google import verify_google_token
from app.auth.session import clear_session_cookie, set_session_cookie
from app.models import User
from app.schemas import AppConfig, DevLoginIn, GoogleLoginIn, Me

router = APIRouter(tags=["auth"])


@router.get("/config")
async def config(settings: SettingsDep) -> AppConfig:
    return AppConfig(google_client_id=settings.google_client_id, dev_login=settings.dev_login)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/auth/google")
async def login_google(body: GoogleLoginIn, response: Response, settings: SettingsDep) -> Me:
    if not settings.google_client_id:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "L'accesso con Google non è ancora configurato."
        )
    try:
        identity = await verify_google_token(body.credential, settings.google_client_id)
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Google non ha confermato l'accesso. Riproviamo?"
        ) from exc

    user = await User.find_one(User.google_sub == identity.sub)
    if user is None:
        user = User(
            google_sub=identity.sub,
            email=identity.email,
            name=identity.name,
            avatar_url=identity.picture,
        )
        await user.insert()
    else:
        user.email = identity.email
        user.avatar_url = identity.picture
        await user.save()

    set_session_cookie(response, str(user.id), settings)
    return Me.of(user)


@router.post("/auth/dev-login")
async def login_dev(body: DevLoginIn, response: Response, settings: SettingsDep) -> Me:
    if not settings.dev_login:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    sub = f"dev:{body.email.lower()}"
    user = await User.find_one(User.google_sub == sub)
    if user is None:
        user = User(google_sub=sub, email=body.email, name=body.name)
        await user.insert()
    set_session_cookie(response, str(user.id), settings)
    return Me.of(user)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, settings: SettingsDep) -> None:
    clear_session_cookie(response, settings)
