import pymongo
from beanie import Document, PydanticObjectId
from pymongo import IndexModel


class Assignment(Document):
    room_id: PydanticObjectId
    giver_id: PydanticObjectId
    receiver_id: PydanticObjectId

    class Settings:
        name = "assignments"
        indexes = [
            IndexModel(
                [("room_id", pymongo.ASCENDING), ("giver_id", pymongo.ASCENDING)],
                unique=True,
            ),
        ]
