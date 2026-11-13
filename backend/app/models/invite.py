from datetime import datetime

import pymongo
from beanie import Document, PydanticObjectId
from pydantic import Field
from pymongo import IndexModel

from app.models.user import utcnow


class Invite(Document):
    room_id: PydanticObjectId
    code_hash: str
    expires_at: datetime
    created_by: PydanticObjectId
    created_at: datetime = Field(default_factory=utcnow)
    used_by: PydanticObjectId | None = None

    class Settings:
        name = "invites"
        indexes = [
            IndexModel([("code_hash", pymongo.ASCENDING)]),
            # Mongo elimina gli inviti scaduti da solo (il monitor TTL gira ogni ~60 s,
            # quindi la scadenza viene comunque controllata anche nel codice).
            IndexModel([("expires_at", pymongo.ASCENDING)], expireAfterSeconds=0),
        ]
