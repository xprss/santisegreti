from dataclasses import dataclass

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from starlette.concurrency import run_in_threadpool

_transport = google_requests.Request()


@dataclass
class GoogleIdentity:
    sub: str
    email: str
    name: str
    picture: str | None


def _verify(token: str, client_id: str) -> GoogleIdentity:
    info = id_token.verify_oauth2_token(token, _transport, client_id)
    if not info.get("email_verified", False):
        raise ValueError("email non verificata")
    return GoogleIdentity(
        sub=info["sub"],
        email=info["email"],
        name=info.get("name") or info["email"].split("@")[0],
        picture=info.get("picture"),
    )


async def verify_google_token(token: str, client_id: str) -> GoogleIdentity:
    # La verifica scarica i certificati Google con una chiamata sincrona: va in un thread.
    return await run_in_threadpool(_verify, token, client_id)
