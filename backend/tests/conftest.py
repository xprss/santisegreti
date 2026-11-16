import asyncio
import json
import os
from collections.abc import AsyncIterator, Awaitable, Callable
from pathlib import Path
from uuid import uuid4

import pytest
from asgi_lifespan import LifespanManager
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pymongo import AsyncMongoClient
from pymongo.errors import PyMongoError

from app.config import Settings
from app.main import create_app

MONGO_URI = os.environ.get("TEST_MONGO_URI", "mongodb://localhost:27017")


async def _mongo_available() -> bool:
    client: AsyncMongoClient = AsyncMongoClient(MONGO_URI, serverSelectionTimeoutMS=1500)
    try:
        await client.admin.command("ping")
        return True
    except PyMongoError:
        return False
    finally:
        await client.close()


@pytest.fixture(scope="session")
async def app() -> AsyncIterator[FastAPI]:
    if not await _mongo_available():
        if os.environ.get("CI"):
            pytest.fail(f"MongoDB non raggiungibile su {MONGO_URI}")
        pytest.skip(f"MongoDB non raggiungibile su {MONGO_URI}")

    db_name = f"santisegreti_test_{uuid4().hex[:8]}"
    settings = Settings(
        mongo_uri=MONGO_URI,
        mongo_db=db_name,
        dev_login=True,
        session_secret="test-secret-" + "x" * 32,
        google_client_id="",
        static_dir=Path("/nonexistent"),
    )
    application = create_app(settings)
    async with LifespanManager(application):
        yield application

    client: AsyncMongoClient = AsyncMongoClient(MONGO_URI)
    await client.drop_database(db_name)
    await client.close()


LoginFactory = Callable[[str], Awaitable[AsyncClient]]


@pytest.fixture
async def login(app: FastAPI) -> AsyncIterator[LoginFactory]:
    """Restituisce un client HTTP già autenticato come un nuovo utente."""
    clients: list[AsyncClient] = []

    async def _login(name: str) -> AsyncClient:
        client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        clients.append(client)
        response = await client.post(
            "/api/auth/dev-login",
            json={"email": f"{name.lower()}-{uuid4().hex[:6]}@example.test", "name": name},
        )
        assert response.status_code == 200, response.text
        client.me = response.json()  # type: ignore[attr-defined]
        return client

    yield _login
    for client in clients:
        await client.aclose()


class WebSocketClosed(Exception):
    def __init__(self, code: int) -> None:
        super().__init__(f"WebSocket chiuso con codice {code}")
        self.code = code


class AsgiWebSocket:
    """Client WebSocket minimo che parla ASGI con l'app, nello stesso event loop dei test.

    httpx non gestisce i WebSocket; così non serve un'altra dipendenza e Beanie resta sul
    suo loop (TestClient di Starlette ne aprirebbe uno nuovo in un altro thread).
    """

    def __init__(self, app: FastAPI, path: str, headers: dict[str, str]) -> None:
        self.app = app
        self.scope = {
            "type": "websocket",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "scheme": "ws",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "root_path": "",
            "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
            "client": ("127.0.0.1", 50000),
            "server": ("test", 80),
            "subprotocols": [],
        }
        self._to_app: asyncio.Queue[dict] = asyncio.Queue()
        self._from_app: asyncio.Queue[dict] = asyncio.Queue()
        self._task: asyncio.Task | None = None

    async def __aenter__(self) -> "AsgiWebSocket":
        self._task = asyncio.create_task(
            self.app(self.scope, self._to_app.get, self._from_app.put)  # type: ignore[arg-type]
        )
        await self._to_app.put({"type": "websocket.connect"})
        message = await asyncio.wait_for(self._from_app.get(), 2)
        if message["type"] == "websocket.close":
            raise WebSocketClosed(message.get("code", 1000))
        assert message["type"] == "websocket.accept", message
        return self

    async def receive_json(self, timeout: float = 2) -> dict:
        message = await asyncio.wait_for(self._from_app.get(), timeout)
        if message["type"] == "websocket.close":
            raise WebSocketClosed(message.get("code", 1000))
        assert message["type"] == "websocket.send", message
        return json.loads(message["text"])

    async def next(self, kind: str, timeout: float = 2) -> dict:
        """Il prossimo messaggio di un certo tipo (`lottery` o `presence`), saltando gli altri."""
        while True:
            message = await self.receive_json(timeout)
            if message["type"] == kind:
                return message

    async def __aexit__(self, *_: object) -> None:
        await self._to_app.put({"type": "websocket.disconnect", "code": 1000})
        if self._task is not None:
            await asyncio.wait_for(self._task, 2)


WebSocketFactory = Callable[..., AsgiWebSocket]


@pytest.fixture
def lottery_ws(app: FastAPI) -> WebSocketFactory:
    """Apre il WebSocket della lotteria di una stanza con i cookie di un client già loggato."""

    def _open(
        client: AsyncClient | None, room_id: str, origin: str | None = "http://test"
    ) -> AsgiWebSocket:
        headers = {"host": "test"}
        if origin:
            headers["origin"] = origin
        if client is not None and client.cookies:
            headers["cookie"] = "; ".join(f"{k}={v}" for k, v in client.cookies.items())
        return AsgiWebSocket(app, f"/api/rooms/{room_id}/lottery/ws", headers)

    return _open
