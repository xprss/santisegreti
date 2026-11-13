from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import Settings, get_settings
from app.db import init_db
from app.routers import auth, draw, exclusions, invites, me, rooms


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    if len(settings.session_secret) < 32:
        raise RuntimeError(
            "SESSION_SECRET deve essere lungo almeno 32 caratteri (es. `openssl rand -hex 32`)."
        )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        client = await init_db(settings)
        try:
            yield
        finally:
            await client.close()

    app = FastAPI(
        title="santisegreti.it",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.dependency_overrides[get_settings] = lambda: settings

    api = APIRouter(prefix="/api")
    for module in (auth, me, rooms, invites, exclusions, draw):
        api.include_router(module.router)
    app.include_router(api)

    if settings.static_dir.is_dir():
        _mount_frontend(app, settings.static_dir)

    return app


def _mount_frontend(app: FastAPI, static_dir: Path) -> None:
    """Serve la build del frontend e rimanda ogni rotta sconosciuta a index.html (SPA)."""
    root = static_dir.resolve()
    assets = root / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        candidate = (root / path).resolve()
        if path and candidate.is_file() and root in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(root / "index.html", headers={"Cache-Control": "no-cache"})
