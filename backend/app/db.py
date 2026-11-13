from beanie import init_beanie
from pymongo import AsyncMongoClient

from app.config import Settings
from app.models import DOCUMENT_MODELS


async def init_db(settings: Settings) -> AsyncMongoClient:
    client: AsyncMongoClient = AsyncMongoClient(settings.mongo_uri, tz_aware=True)
    await init_beanie(database=client[settings.mongo_db], document_models=DOCUMENT_MODELS)
    return client
