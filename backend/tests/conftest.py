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
