from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "santisegreti"

    google_client_id: str = ""
    # Almeno 32 caratteri casuali, es. `openssl rand -hex 32`.
    session_secret: str = ""
    session_days: int = 30
    cookie_secure: bool = False

    # Abilita POST /api/auth/dev-login. Solo per lo sviluppo locale e i test.
    dev_login: bool = False

    # Cartella con la build del frontend (presente solo nell'immagine di produzione).
    static_dir: Path = Path(__file__).resolve().parent.parent / "static"

    invite_ttl_seconds: int = 180

    # Dal "Estrai" dell'admin alla rivelazione del vincitore, uguale per tutti i collegati.
    lottery_countdown_seconds: float = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()
