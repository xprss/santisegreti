from datetime import date, datetime
from typing import Annotated, Literal

from beanie import PydanticObjectId
from pydantic import BaseModel, Field, StringConstraints

from app.models import Accessory, Room, RoomStatus, User

HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9A-Fa-f]{6}$")]
RoomName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Theme = Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]
DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
Bio = Annotated[str, StringConstraints(strip_whitespace=True, max_length=280)]
Budget = Annotated[int, Field(ge=1, le=10_000)]


class AppConfig(BaseModel):
    google_client_id: str
    dev_login: bool


class GoogleLoginIn(BaseModel):
    credential: str


class DevLoginIn(BaseModel):
    email: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=120)]
    name: DisplayName


class UserPublic(BaseModel):
    id: PydanticObjectId
    name: str
    bio: str
    color: str
    accessory: Accessory | None
    avatar_url: str | None

    @classmethod
    def of(cls, user: User) -> "UserPublic":
        return cls(
            id=user.id,
            name=user.name,
            bio=user.bio,
            color=user.color,
            accessory=user.accessory,
            avatar_url=user.avatar_url,
        )


class Me(UserPublic):
    email: str
    # Accessori speciali vinti e già utilizzabili.
    unlocked_accessories: list[Accessory]

    @classmethod
    def of(cls, user: User) -> "Me":
        return cls(
            **UserPublic.of(user).model_dump(),
            email=user.email,
            unlocked_accessories=user.unlocked_accessories(),
        )


class MeUpdate(BaseModel):
    name: DisplayName | None = None
    bio: Bio | None = None
    color: HexColor | None = None
    # Uno solo, oppure null per toglierlo.
    accessory: Accessory | None = None


class RoomCreate(BaseModel):
    name: RoomName
    theme: Theme | None = None
    budget_eur: Budget = 25
    exchange_date: date | None = None


class RoomUpdate(BaseModel):
    name: RoomName | None = None
    theme: Theme | None = None
    budget_eur: Budget | None = None
    exchange_date: date | None = None


class RoomSummary(BaseModel):
    id: PydanticObjectId
    name: str
    theme: str | None
    budget_eur: int
    exchange_date: date | None
    status: RoomStatus
    participant_count: int
    is_admin: bool

    @classmethod
    def of(cls, room: Room, user: User) -> "RoomSummary":
        return cls(
            id=room.id,
            name=room.name,
            theme=room.theme,
            budget_eur=room.budget_eur,
            exchange_date=room.exchange_date,
            status=room.status,
            participant_count=len(room.participant_ids),
            is_admin=room.admin_id == user.id,
        )


class ExclusionGroupIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    member_ids: Annotated[list[PydanticObjectId], Field(min_length=2)]


class ExclusionGroupOut(BaseModel):
    id: str
    name: str
    member_ids: list[PydanticObjectId]


class RoomDetail(RoomSummary):
    admin_id: PydanticObjectId
    drawn_at: datetime | None
    participants: list[UserPublic]
    # Solo per l'admin: agli altri partecipanti arriva vuoto.
    exclusion_groups: list[ExclusionGroupOut]


class InviteOut(BaseModel):
    code: str
    expires_at: datetime
    # Il countdown nel browser parte da qui: non dipende dall'orologio del dispositivo.
    expires_in: int


class RedeemIn(BaseModel):
    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]


class RedeemOut(BaseModel):
    room_id: PydanticObjectId
    already_member: bool


class MyAssignment(BaseModel):
    receiver: UserPublic | None


# `countdown`: estratta ma non ancora rivelata. Il vincitore c'è già, però non esce dal server.
LotteryPhase = Literal["draft", "open", "countdown", "drawn"]


class TicketOut(BaseModel):
    number: str
    taken_at: datetime


class LotteryWinner(BaseModel):
    user: UserPublic
    number: str


class LotteryOut(BaseModel):
    status: LotteryPhase
    prize: Accessory
    ticket_count: int
    # Chi ha il biglietto lo vedono tutti; il numero, solo chi lo possiede.
    ticket_holder_ids: list[PydanticObjectId]
    my_ticket: TicketOut | None
    # Solo durante il countdown: millisecondi alla rivelazione, contati dal server
    # (il browser non deve fidarsi del proprio orologio).
    countdown_ms: int | None
    winner: LotteryWinner | None
    opened_at: datetime | None
    drawn_at: datetime | None
