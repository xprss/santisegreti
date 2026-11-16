"""Chi ha aperta la pagina di una stanza, collegato al WebSocket della lotteria.

Tutto sta in memoria: va bene perché l'app gira in un solo processo uvicorn (vedi il
Dockerfile). Con più worker o più repliche servirebbe un canale condiviso tra i processi,
per esempio i change stream di Mongo o un pub/sub.
"""

import asyncio
import contextlib
import logging
from datetime import datetime
from typing import Annotated, Any

from beanie import PydanticObjectId
from fastapi import Depends, Request, WebSocket

from app.models import Lottery, LotteryStatus, Room
from app.models.user import utcnow
from app.services.lottery import load_winner, lottery_view, wear_prize_if_revealed

log = logging.getLogger(__name__)

# Chiusure del WebSocket con un significato per il client (4000–4999 sono libere).
CLOSE_UNAUTHORIZED = 4401
CLOSE_FORBIDDEN_ORIGIN = 4403
CLOSE_NOT_A_MEMBER = 4404


class LotteryHub:
    def __init__(self) -> None:
        self._rooms: dict[PydanticObjectId, dict[WebSocket, PydanticObjectId]] = {}
        # Un lock per stanza: due broadcast in parallelo non devono arrivare in ordine
        # inverso (lo stato più vecchio sovrascriverebbe quello nuovo nel browser).
        self._locks: dict[PydanticObjectId, asyncio.Lock] = {}
        self._reveals: dict[PydanticObjectId, asyncio.Task[None]] = {}

    # --- connessioni e presenza ----------------------------------------------------------

    def online(self, room_id: PydanticObjectId) -> list[PydanticObjectId]:
        """Chi è collegato adesso, ognuno una volta sola anche con più schede aperte."""
        return list(dict.fromkeys(self._rooms.get(room_id, {}).values()))

    async def connect(
        self, room_id: PydanticObjectId, websocket: WebSocket, user_id: PydanticObjectId
    ) -> None:
        async with self._lock(room_id):
            self._rooms.setdefault(room_id, {})[websocket] = user_id
            room = await Room.get(room_id)
            if room is not None:
                messages = await self._lottery_messages(room, {websocket: user_id})
                await self._send(websocket, messages[websocket])
        await self.broadcast_presence(room_id)

    async def disconnect(self, room_id: PydanticObjectId, websocket: WebSocket) -> None:
        sockets = self._rooms.get(room_id)
        if sockets is None or sockets.pop(websocket, None) is None:
            return
        if not sockets:
            self._rooms.pop(room_id, None)
        await self.broadcast_presence(room_id)

    async def broadcast_presence(self, room_id: PydanticObjectId) -> None:
        message = {"type": "presence", "online": [str(uid) for uid in self.online(room_id)]}
        sockets = list(self._rooms.get(room_id, {}))
        await asyncio.gather(*(self._send(ws, message) for ws in sockets))

    async def kick(self, room_id: PydanticObjectId, user_id: PydanticObjectId) -> None:
        """Chi esce dalla stanza smette di ricevere la lotteria."""
        sockets = [ws for ws, uid in self._rooms.get(room_id, {}).items() if uid == user_id]
        for ws in sockets:
            await self._close(ws, CLOSE_NOT_A_MEMBER)
            await self.disconnect(room_id, ws)

    async def close_room(self, room_id: PydanticObjectId) -> None:
        self.cancel_reveal(room_id)
        for ws in list(self._rooms.pop(room_id, {})):
            await self._close(ws, CLOSE_NOT_A_MEMBER)

    # --- stato della lotteria --------------------------------------------------------------

    async def broadcast_lottery(self, room_id: PydanticObjectId) -> None:
        async with self._lock(room_id):
            sockets = dict(self._rooms.get(room_id, {}))
            if not sockets:
                return
            room = await Room.get(room_id)
            if room is None:
                return
            messages = await self._lottery_messages(room, sockets)
            await asyncio.gather(*(self._send(ws, msg) for ws, msg in messages.items()))

    async def _lottery_messages(
        self, room: Room, sockets: dict[WebSocket, PydanticObjectId]
    ) -> dict[WebSocket, dict[str, Any]]:
        # Una lettura sola per tutti; la vista cambia da persona a persona (il proprio biglietto).
        now = utcnow()
        lottery = await Lottery.find_one(Lottery.room_id == room.id)
        winner = await load_winner(lottery, now) if lottery else None
        messages = {}
        for ws, user_id in sockets.items():
            view = lottery_view(lottery, room, user_id, now, winner)
            messages[ws] = {
                "type": "lottery",
                "lottery": view.model_dump(mode="json") if view else None,
            }
        return messages

    # --- countdown --------------------------------------------------------------------------

    def schedule_reveal(self, room_id: PydanticObjectId, reveal_at: datetime) -> None:
        """A fine countdown il vincitore parte verso tutti i collegati nello stesso momento."""
        self.cancel_reveal(room_id)
        task = asyncio.create_task(self._reveal_at(room_id, reveal_at))
        self._reveals[room_id] = task

        def forget(done: asyncio.Task[None]) -> None:
            if self._reveals.get(room_id) is done:
                del self._reveals[room_id]

        task.add_done_callback(forget)

    def cancel_reveal(self, room_id: PydanticObjectId) -> None:
        task = self._reveals.pop(room_id, None)
        if task is not None:
            task.cancel()

    async def _reveal_at(self, room_id: PydanticObjectId, reveal_at: datetime) -> None:
        # Mai in anticipo: sleep può svegliarsi un filo prima rispetto all'orologio di sistema.
        while (left := (reveal_at - utcnow()).total_seconds()) > 0:
            await asyncio.sleep(left + 0.005)
        try:
            lottery = await Lottery.find_one(Lottery.room_id == room_id)
            if lottery is not None:
                await wear_prize_if_revealed(lottery.id)
            await self.broadcast_lottery(room_id)
        except Exception:
            log.exception("Rivelazione della lotteria non inviata (stanza %s)", room_id)

    async def resume_pending(self) -> None:
        """Dopo un riavvio: i countdown ancora in corso devono comunque arrivare a zero, e chi
        ha vinto mentre il server era giù deve trovarsi comunque il premio addosso."""
        pending = await Lottery.find(
            Lottery.status == LotteryStatus.DRAWN,
            Lottery.prize_worn != True,  # noqa: E712
        ).to_list()
        for lottery in pending:
            if lottery.reveal_at is not None:
                self.schedule_reveal(lottery.room_id, lottery.reveal_at)

    async def shutdown(self) -> None:
        for room_id in list(self._reveals):
            self.cancel_reveal(room_id)
        for room_id in list(self._rooms):
            for ws in list(self._rooms.pop(room_id, {})):
                await self._close(ws, 1001)

    # --- dettagli ---------------------------------------------------------------------------

    def _lock(self, room_id: PydanticObjectId) -> asyncio.Lock:
        return self._locks.setdefault(room_id, asyncio.Lock())

    @staticmethod
    async def _send(ws: WebSocket, message: dict) -> None:
        # Connessione già chiusa: la toglie il suo handler (che poi avvisa gli altri),
        # qui basta non bloccare l'invio a tutti gli altri.
        with contextlib.suppress(Exception):
            await ws.send_json(message)

    @staticmethod
    async def _close(ws: WebSocket, code: int) -> None:
        with contextlib.suppress(Exception):
            await ws.close(code)


def get_lottery_hub(request: Request) -> LotteryHub:
    return request.app.state.lottery_hub


LotteryHubDep = Annotated[LotteryHub, Depends(get_lottery_hub)]
