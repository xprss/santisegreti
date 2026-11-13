from datetime import timedelta

from httpx import AsyncClient

from app.models import Invite
from app.models.user import utcnow
from app.services.otp import ALPHABET, CODE_LENGTH


async def create_room(admin: AsyncClient, **extra) -> dict:
    response = await admin.post("/api/rooms", json={"name": "Ufficio", **extra})
    assert response.status_code == 201, response.text
    return response.json()


async def invite_and_join(admin: AsyncClient, room_id: str, guest: AsyncClient) -> None:
    code = (await admin.post(f"/api/rooms/{room_id}/invites")).json()["code"]
    response = await guest.post("/api/invites/redeem", json={"code": code})
    assert response.status_code == 200, response.text
    assert response.json() == {"room_id": room_id, "already_member": False}


async def test_requires_login(app):
    from httpx import ASGITransport

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as anon:
        assert (await anon.get("/api/me")).status_code == 401
        assert (await anon.get("/api/rooms")).status_code == 401
        config = (await anon.get("/api/config")).json()
        assert config == {"google_client_id": "", "dev_login": True}


async def test_profile_update(login):
    anna = await login("Anna")
    assert anna.me["color"].startswith("#")
    response = await anna.patch("/api/me", json={"bio": "Amo i calzini buffi", "color": "#ab12cd"})
    assert response.status_code == 200
    assert response.json()["bio"] == "Amo i calzini buffi"
    assert response.json()["color"] == "#AB12CD"
    assert (await anna.patch("/api/me", json={"color": "rosso"})).status_code == 422
    assert (await anna.patch("/api/me", json={"bio": "x" * 281})).status_code == 422


async def test_accessory_is_one_or_none(login):
    anna = await login("Anna")
    assert anna.me["accessory"] is None

    response = await anna.patch("/api/me", json={"accessory": "witch_hat"})
    assert response.json()["accessory"] == "witch_hat"

    # Cambiare altro non tocca l'accessorio.
    response = await anna.patch("/api/me", json={"bio": "Abracadabra"})
    assert response.json()["accessory"] == "witch_hat"

    # Un accessorio sostituisce il precedente: ce n'è sempre al massimo uno.
    response = await anna.patch("/api/me", json={"accessory": "scarf"})
    assert response.json()["accessory"] == "scarf"

    assert (await anna.patch("/api/me", json={"accessory": "jetpack"})).status_code == 422
    assert (await anna.patch("/api/me", json={"accessory": ["tie", "scarf"]})).status_code == 422

    response = await anna.patch("/api/me", json={"accessory": None})
    assert response.json()["accessory"] is None


async def test_room_lifecycle(login):
    anna, bruno, carla, dario = [await login(n) for n in ("Anna", "Bruno", "Carla", "Dario")]

    room = await create_room(anna, theme="Fatto a mano", budget_eur=30, exchange_date="2026-12-20")
    room_id = room["id"]
    assert room["is_admin"] and room["status"] == "open"
    assert room["budget_eur"] == 30 and room["exchange_date"] == "2026-12-20"
    assert [p["name"] for p in room["participants"]] == ["Anna"]

    # Chi non è nella stanza non la vede nemmeno.
    assert (await bruno.get(f"/api/rooms/{room_id}")).status_code == 404

    for guest in (bruno, carla, dario):
        await invite_and_join(anna, room_id, guest)

    detail = (await bruno.get(f"/api/rooms/{room_id}")).json()
    assert detail["participant_count"] == 4 and not detail["is_admin"]
    assert detail["exclusion_groups"] == []

    # Solo l'admin modifica, estrae, crea esclusioni.
    assert (await bruno.patch(f"/api/rooms/{room_id}", json={"budget_eur": 5})).status_code == 403
    assert (await bruno.post(f"/api/rooms/{room_id}/draw")).status_code == 403

    group = await anna.post(
        f"/api/rooms/{room_id}/exclusions",
        json={"name": "Coppia", "member_ids": [bruno.me["id"], carla.me["id"]]},
    )
    assert group.status_code == 201

    updated = await anna.patch(f"/api/rooms/{room_id}", json={"theme": None, "budget_eur": 20})
    assert updated.json()["theme"] is None and updated.json()["budget_eur"] == 20

    # Prima dell'estrazione nessuno ha un abbinamento.
    assert (await bruno.get(f"/api/rooms/{room_id}/my-assignment")).json() == {"receiver": None}

    drawn = await anna.post(f"/api/rooms/{room_id}/draw")
    assert drawn.status_code == 200, drawn.text
    assert drawn.json()["status"] == "drawn"
    assert (await anna.post(f"/api/rooms/{room_id}/draw")).status_code == 409

    receivers = {}
    for person in (anna, bruno, carla, dario):
        receiver = (await person.get(f"/api/rooms/{room_id}/my-assignment")).json()["receiver"]
        assert receiver is not None and receiver["id"] != person.me["id"]
        assert set(receiver) == {"id", "name", "bio", "color", "accessory", "avatar_url"}
        receivers[person.me["id"]] = receiver["id"]
    assert sorted(receivers.values()) == sorted(receivers)
    assert receivers[bruno.me["id"]] != carla.me["id"]
    assert receivers[carla.me["id"]] != bruno.me["id"]

    # A estrazione fatta la stanza è chiusa.
    assert (await anna.post(f"/api/rooms/{room_id}/invites")).status_code == 409
    leave = await dario.delete(f"/api/rooms/{room_id}/participants/{dario.me['id']}")
    assert leave.status_code == 409

    # L'admin annulla, Dario esce, si rifà l'estrazione con tre persone.
    assert (await anna.delete(f"/api/rooms/{room_id}/draw")).json()["status"] == "open"
    assert (await bruno.get(f"/api/rooms/{room_id}/my-assignment")).json() == {"receiver": None}
    leave = await dario.delete(f"/api/rooms/{room_id}/participants/{dario.me['id']}")
    assert leave.status_code == 204
    assert (await dario.get(f"/api/rooms/{room_id}")).status_code == 404

    # Con Bruno e Carla esclusi tra loro e solo tre persone, non c'è un abbinamento possibile.
    impossible = await anna.post(f"/api/rooms/{room_id}/draw")
    assert impossible.status_code == 422
    assert "esclusioni" in impossible.json()["detail"]

    group_id = group.json()["id"]
    assert (await anna.delete(f"/api/rooms/{room_id}/exclusions/{group_id}")).status_code == 204
    assert (await anna.post(f"/api/rooms/{room_id}/draw")).status_code == 200


async def test_admin_cannot_leave_and_others_cannot_kick(login):
    anna, bruno, carla = [await login(n) for n in ("Anna", "Bruno", "Carla")]
    room_id = (await create_room(anna))["id"]
    await invite_and_join(anna, room_id, bruno)
    await invite_and_join(anna, room_id, carla)

    kick = await bruno.delete(f"/api/rooms/{room_id}/participants/{carla.me['id']}")
    assert kick.status_code == 403
    admin_leave = await anna.delete(f"/api/rooms/{room_id}/participants/{anna.me['id']}")
    assert admin_leave.status_code == 400
    kick = await anna.delete(f"/api/rooms/{room_id}/participants/{carla.me['id']}")
    assert kick.status_code == 204


async def test_invite_codes(login):
    anna, bruno, carla = [await login(n) for n in ("Anna", "Bruno", "Carla")]
    room_id = (await create_room(anna))["id"]

    invite = (await anna.post(f"/api/rooms/{room_id}/invites")).json()
    code = invite["code"]
    assert invite["expires_in"] == 180
    assert len(code) == CODE_LENGTH and all(ch in ALPHABET for ch in code)
    assert (await bruno.post(f"/api/rooms/{room_id}/invites")).status_code == 404

    # Minuscole e spazi vanno bene.
    spaced = f" {code[:3].lower()} {code[3:].lower()} "
    assert (await bruno.post("/api/invites/redeem", json={"code": spaced})).status_code == 200

    # Monouso.
    reused = await carla.post("/api/invites/redeem", json={"code": code})
    assert reused.status_code == 410 and "già stato usato" in reused.json()["detail"]

    # Chi è già dentro non consuma niente.
    again = await bruno.post("/api/invites/redeem", json={"code": code})
    assert again.json()["already_member"] is True

    # Scaduto.
    code = (await anna.post(f"/api/rooms/{room_id}/invites")).json()["code"]
    await Invite.get_pymongo_collection().update_many(
        {"used_by": None}, {"$set": {"expires_at": utcnow() - timedelta(seconds=1)}}
    )
    expired = await carla.post("/api/invites/redeem", json={"code": code})
    assert expired.status_code == 410 and "scaduto" in expired.json()["detail"]

    missing = await carla.post("/api/invites/redeem", json={"code": "ZZZZZZ"})
    assert missing.status_code == 404


async def test_delete_room(login):
    anna, bruno = [await login(n) for n in ("Anna", "Bruno")]
    room_id = (await create_room(anna))["id"]
    await invite_and_join(anna, room_id, bruno)
    assert (await bruno.delete(f"/api/rooms/{room_id}")).status_code == 403
    assert (await anna.delete(f"/api/rooms/{room_id}")).status_code == 204
    assert (await anna.get("/api/rooms")).json() == []
