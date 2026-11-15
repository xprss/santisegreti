from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
async def client(tmp_path: Path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "index-abc123.js").write_text("console.log(1)")
    (tmp_path / "index.html").write_text("<!doctype html><title>Santi Segreti</title>")
    (tmp_path / "sw.js").write_text("self.skipWaiting()")
    (tmp_path / "manifest.webmanifest").write_text('{"name": "Santi Segreti"}')
    settings = Settings(
        mongo_uri="mongodb://localhost:27017",
        mongo_db="unused",
        session_secret="test-secret-" + "x" * 32,
        google_client_id="",
        static_dir=tmp_path,
    )
    # Senza lifespan: le rotte statiche non toccano il database.
    transport = ASGITransport(app=create_app(settings))
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_pwa_files_are_revalidated(client: AsyncClient):
    sw = await client.get("/sw.js")
    assert sw.status_code == 200
    assert sw.headers["cache-control"] == "no-cache"
    assert "javascript" in sw.headers["content-type"]

    manifest = await client.get("/manifest.webmanifest")
    assert manifest.status_code == 200
    assert manifest.headers["cache-control"] == "no-cache"
    assert manifest.headers["content-type"].startswith("application/manifest+json")


async def test_spa_fallback_and_hashed_assets(client: AsyncClient):
    page = await client.get("/stanze/123")
    assert page.status_code == 200
    assert "Santi Segreti" in page.text
    assert page.headers["cache-control"] == "no-cache"

    asset = await client.get("/assets/index-abc123.js")
    assert asset.status_code == 200
    assert "cache-control" not in asset.headers

    assert (await client.get("/api/nope")).status_code == 404
