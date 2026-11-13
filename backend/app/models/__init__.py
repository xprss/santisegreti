from app.models.assignment import Assignment
from app.models.invite import Invite
from app.models.room import ExclusionGroup, Room, RoomStatus
from app.models.user import User

DOCUMENT_MODELS = [User, Room, Invite, Assignment]

__all__ = [
    "DOCUMENT_MODELS",
    "Assignment",
    "ExclusionGroup",
    "Invite",
    "Room",
    "RoomStatus",
    "User",
]
