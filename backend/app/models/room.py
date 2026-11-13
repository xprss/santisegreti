from datetime import date, datetime
from enum import StrEnum
from uuid import uuid4

from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field

from app.models.user import utcnow

DEFAULT_BUDGET_EUR = 25


class RoomStatus(StrEnum):
    OPEN = "open"
    DRAWN = "drawn"


class ExclusionGroup(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    name: str
    member_ids: list[PydanticObjectId]


class Room(Document):
    name: str
    theme: str | None = None
    budget_eur: int = DEFAULT_BUDGET_EUR
    exchange_date: date | None = None
    admin_id: PydanticObjectId
    participant_ids: list[PydanticObjectId]
    exclusion_groups: list[ExclusionGroup] = Field(default_factory=list)
    status: RoomStatus = RoomStatus.OPEN
    drawn_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "rooms"
        indexes = ["participant_ids"]
