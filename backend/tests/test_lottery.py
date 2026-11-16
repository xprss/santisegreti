import asyncio
import re

import pytest

from app.config import get_settings
from tests.conftest import WebSocketClosed
from tests.test_api import create_room, invite_and_join

TICKET = re.compile(r"^SANTO-\d{6}$")


async def room_with(login, *names: str):
    """Una stanza con dentro queste persone; la prima è l'admin."""
    people = [await login(name) for name in names]
    room_id = (await create_room(people[0]))["id"]
    for guest in people[1:]:
        await invite_and_join(people[0], room_id, guest)
    return room_id, people


async def open_lottery(admin, room_id: str) -> str:
    url = f"/api/rooms/{room_id}/lottery"
    assert (await admin.post(url)).status_code == 201
    assert (await admin.post(f"{url}/open")).status_code == 200
    return url


@pytest.fixture
def countdown(app, monkeypatch):
    """Accorcia il countdown dell'estrazione (di base 10 secondi)."""
    settings = app.dependency_overrides[get_settings]()

    def _set(seconds: float) -> None:
        monkeypatch.setattr(settings, "lottery_countdown_seconds", seconds)

    return _set


async def test_lottery_lifecycle(login):
    room_id, (anna, bruno, carla) = await room_with(login, "Anna", "Bruno", "Carla")
    url = f"/api/rooms/{room_id}/lottery"

    response = await bruno.get(url)
    assert response.status_code == 200 and response.json() is None

    # Solo l'admin la crea, e ce n'è una sola per stanza.
    assert (await bruno.post(url)).status_code == 403
    created = await anna.post(url)
    assert created.status_code == 201, created.text
    assert created.json()["status"] == "draft"
    assert created.json()["prize"] == "flower_tunic"
    assert (await anna.post(url)).status_code == 409

    # In bozza gli altri non la vedono, e nessuno prende biglietti.
    assert (await bruno.get(url)).json() is None
    assert (await bruno.post(f"{url}/tickets")).status_code == 404
    assert (await anna.post(f"{url}/tickets")).status_code == 409

    assert (await bruno.post(f"{url}/open")).status_code == 403
    opened = await anna.post(f"{url}/open")
    assert opened.json()["status"] == "open"
    assert (await anna.post(f"{url}/open")).status_code == 409
    assert (await anna.post(f"{url}/draw")).status_code == 422

    # Un biglietto a testa, con un numero tutto suo.
    taken = await bruno.post(f"{url}/tickets")
    assert taken.status_code == 201, taken.text
    bruno_number = taken.json()["my_ticket"]["number"]
    assert TICKET.match(bruno_number)
    again = await bruno.post(f"{url}/tickets")
    assert again.status_code == 409 and "già" in again.json()["detail"]
    carla_number = (await carla.post(f"{url}/tickets")).json()["my_ticket"]["number"]
    assert TICKET.match(carla_number) and carla_number != bruno_number

    # Tutti vedono chi ha il biglietto; il numero, solo chi lo possiede.
    seen_by_anna = (await anna.get(url)).json()
    assert seen_by_anna["ticket_count"] == 2
    assert set(seen_by_anna["ticket_holder_ids"]) == {bruno.me["id"], carla.me["id"]}
    assert seen_by_anna["my_ticket"] is None

    assert (await bruno.post(f"{url}/draw")).status_code == 403
    drawn = await anna.post(f"{url}/draw")
    assert drawn.status_code == 200, drawn.text
    # Il countdown è partito: il vincitore esiste già, ma non esce dal server.
    for viewer in (anna, bruno, carla):
        lottery = (await viewer.get(url)).json()
        assert lottery["status"] == "countdown"
        assert 0 < lottery["countdown_ms"] <= 10_000
        assert lottery["winner"] is None
        assert (await viewer.get("/api/me")).json()["unlocked_accessories"] == []

    late = await anna.post(f"{url}/tickets")
    assert late.status_code == 409 and "partita" in late.json()["detail"]
    assert (await anna.delete(url)).status_code == 409
    assert (await anna.post(f"{url}/open")).status_code == 409
    assert (await anna.post(f"{url}/draw")).status_code == 409


async def test_reveal_unlocks_the_prize(login, countdown):
    countdown(0.15)
    room_id, (anna, bruno, carla) = await room_with(login, "Anna", "Bruno", "Carla")
    url = await open_lottery(anna, room_id)
    numbers = {}
    for person in (bruno, carla):
        numbers[person.me["id"]] = (await person.post(f"{url}/tickets")).json()["my_ticket"][
            "number"
        ]

    assert (await anna.post(f"{url}/draw")).json()["status"] == "countdown"
    await asyncio.sleep(0.25)

    lottery = (await bruno.get(url)).json()
    assert lottery["status"] == "drawn"
    winner_id = lottery["winner"]["user"]["id"]
    assert lottery["winner"]["number"] == numbers[winner_id]
    winner, loser = (bruno, carla) if winner_id == bruno.me["id"] else (carla, bruno)

    assert (await winner.get("/api/me")).json()["unlocked_accessories"] == ["flower_tunic"]
    assert (await loser.get("/api/me")).json()["unlocked_accessories"] == []

    # Vinta, non indossata: la mette chi vuole, e solo chi l'ha vinta.
    assert (await winner.get("/api/me")).json()["accessory"] is None
    refused = await loser.patch("/api/me", json={"accessory": "flower_tunic"})
    assert refused.status_code == 403 and "lotteria" in refused.json()["detail"]
    worn = await winner.patch("/api/me", json={"accessory": "flower_tunic"})
    assert worn.status_code == 200 and worn.json()["accessory"] == "flower_tunic"

    # Il premio resta anche se la stanza sparisce.
    assert (await anna.delete(f"/api/rooms/{room_id}")).status_code == 204
    assert (await winner.get("/api/me")).json()["unlocked_accessories"] == ["flower_tunic"]


async def test_leaving_drops_the_ticket_and_admin_can_cancel(login):
    room_id, (anna, bruno, carla) = await room_with(login, "Anna", "Bruno", "Carla")
    url = await open_lottery(anna, room_id)
    await bruno.post(f"{url}/tickets")
    await carla.post(f"{url}/tickets")

    leave = await carla.delete(f"/api/rooms/{room_id}/participants/{carla.me['id']}")
    assert leave.status_code == 204
    lottery = (await anna.get(url)).json()
    assert lottery["ticket_count"] == 1 and lottery["ticket_holder_ids"] == [bruno.me["id"]]
    assert (await anna.post(f"{url}/draw")).status_code == 422

    # Prima dell'estrazione l'admin può annullarla e ricominciare.
    assert (await bruno.delete(url)).status_code == 403
    assert (await anna.delete(url)).status_code == 204
    assert (await bruno.get(url)).json() is None
    assert (await anna.post(url)).status_code == 201


async def test_special_accessory_is_locked(login):
    anna = await login("Anna")
    assert anna.me["unlocked_accessories"] == []
    response = await anna.patch("/api/me", json={"accessory": "flower_tunic"})
    assert response.status_code == 403


async def test_websocket_live_draw(login, lottery_ws, countdown):
    countdown(0.3)
    room_id, (anna, bruno, carla) = await room_with(login, "Anna", "Bruno", "Carla")
    url = await open_lottery(anna, room_id)

    async with lottery_ws(anna, room_id) as anna_ws, lottery_ws(bruno, room_id) as bruno_ws:
        assert (await anna_ws.next("lottery"))["lottery"]["status"] == "open"
        assert (await bruno_ws.next("lottery"))["lottery"]["status"] == "open"
        online = (await anna_ws.next("presence"))["online"]
        if online == [anna.me["id"]]:
            online = (await anna_ws.next("presence"))["online"]
        assert online == [anna.me["id"], bruno.me["id"]]

        # Il biglietto di Bruno arriva a tutti, ma il numero solo a lui.
        number = (await bruno.post(f"{url}/tickets")).json()["my_ticket"]["number"]
        seen_by_anna = (await anna_ws.next("lottery"))["lottery"]
        seen_by_bruno = (await bruno_ws.next("lottery"))["lottery"]
        assert seen_by_anna["ticket_holder_ids"] == [bruno.me["id"]]
        assert seen_by_anna["my_ticket"] is None
        assert seen_by_bruno["my_ticket"]["number"] == number

        await carla.post(f"{url}/tickets")
        await anna_ws.next("lottery")
        await bruno_ws.next("lottery")

        # Estrazione: prima il countdown senza vincitore, poi la rivelazione per tutti.
        assert (await anna.post(f"{url}/draw")).status_code == 200
        reveals = []
        for ws in (anna_ws, bruno_ws):
            started = (await ws.next("lottery"))["lottery"]
            assert started["status"] == "countdown" and started["winner"] is None
            assert started["countdown_ms"] > 0
        for ws in (anna_ws, bruno_ws):
            reveal = (await ws.next("lottery"))["lottery"]
            assert reveal["status"] == "drawn"
            reveals.append(reveal["winner"])
        assert reveals[0] == reveals[1]
        assert reveals[0]["user"]["id"] in {bruno.me["id"], carla.me["id"]}

        # Chi arriva dopo trova subito il risultato; chi se ne va sparisce dalla presenza.
        async with lottery_ws(carla, room_id) as carla_ws:
            assert (await carla_ws.next("lottery"))["lottery"]["winner"] == reveals[0]
        online = (await anna_ws.next("presence"))["online"]
        while carla.me["id"] in online:
            online = (await anna_ws.next("presence"))["online"]
        assert online == [anna.me["id"], bruno.me["id"]]


async def test_websocket_refuses_strangers(login, lottery_ws):
    room_id, (anna, bruno) = await room_with(login, "Anna", "Bruno")
    dario = await login("Dario")

    async def close_code(client, origin: str | None = "http://test") -> int:
        with pytest.raises(WebSocketClosed) as closed:
            async with lottery_ws(client, room_id, origin) as ws:
                await ws.receive_json()
        return closed.value.code

    assert await close_code(None) == 4401
    assert await close_code(dario) == 4404
    assert await close_code(anna, origin="https://altro-sito.example") == 4403

    # Chi viene fatto uscire dalla stanza perde anche il collegamento.
    async with lottery_ws(bruno, room_id) as bruno_ws:
        await bruno_ws.next("presence")
        kick = await anna.delete(f"/api/rooms/{room_id}/participants/{bruno.me['id']}")
        assert kick.status_code == 204
        with pytest.raises(WebSocketClosed) as closed:
            await bruno_ws.next("never")
        assert closed.value.code == 4404
