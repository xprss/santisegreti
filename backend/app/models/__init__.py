from app.models.accessories import Accessory
from app.models.assignment import Assignment
from app.models.invite import Invite
from app.models.lottery import Lottery, LotteryStatus, Ticket
from app.models.room import ExclusionGroup, Room, RoomStatus
from app.models.user import User

DOCUMENT_MODELS = [User, Room, Invite, Assignment, Lottery]

__all__ = [
    "DOCUMENT_MODELS",
    "Accessory",
    "Assignment",
    "ExclusionGroup",
    "Invite",
    "Lottery",
    "LotteryStatus",
    "Room",
    "RoomStatus",
    "Ticket",
    "User",
]
