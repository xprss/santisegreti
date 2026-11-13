"""Stanza demo per lo sviluppo: una dozzina di persone attorno all'albero.

    docker compose -f compose.dev.yaml exec backend python -m scripts.seed_dev [email-admin]

Gli utenti creati entrano con il login di prova (DEV_LOGIN=true) usando la loro email.
"""

import asyncio
import sys

from app.config import get_settings
from app.db import init_db
from app.models import Accessory, ExclusionGroup, Room, User
from app.models.user import DEFAULT_COLORS

PEOPLE = [
    ("Anna", "Tè verde, gialli svedesi e piante grasse che sopravvivono a tutto.", "santa_hat"),
    ("Bruno", "Cucino il ragù la domenica. Non chiedetemi di cantare.", "mustache"),
    ("Carla", "Corro la mattina presto e colleziono tazze spaiate.", "headphones"),
    ("Dario", "Vinili, caffè lungo, e un gatto che si chiama Pepe.", "sunglasses"),
    ("Elena", "Disegno sui margini dei quaderni da quando ho cinque anni.", "witch_hat"),
    ("Fabio", "Montagna d'estate, montagna d'inverno. Montagna.", "ski_goggles"),
    ("Giulia", "Leggo gialli e indovino sempre il colpevole a metà.", "glasses"),
    ("Hamid", "Faccio il pane in casa, il lievito madre si chiama Gino.", "scarf"),
    ("Irene", "Giochi da tavolo, più sono lunghi più mi piacciono.", "crown"),
    ("Luca", "Bici, birre artigianali e podcast di storia.", "school_backpack"),
    ("Marta", "Calzini spaiati come stile di vita.", "clown_wig"),
    ("Nico", "", None),
]


async def main(admin_email: str) -> None:
    await init_db(get_settings())

    users: list[User] = []
    for index, (name, bio, accessory) in enumerate(PEOPLE):
        email = admin_email if index == 0 else f"{name.lower()}@example.test"
        sub = f"dev:{email.lower()}"
        user = await User.find_one(User.google_sub == sub)
        if user is None:
            user = User(google_sub=sub, email=email, name=name)
        user.bio = bio
        user.accessory = Accessory(accessory) if accessory else None
        user.color = DEFAULT_COLORS[index % len(DEFAULT_COLORS)]
        await user.save()
        users.append(user)

    ids = [u.id for u in users]
    room = Room(
        name="Natale in ufficio",
        theme="Qualcosa fatto a mano, o comprato in un negozio di quartiere",
        budget_eur=25,
        exchange_date=None,
        admin_id=ids[0],
        participant_ids=ids,
        exclusion_groups=[ExclusionGroup(name="Coppia Bruno e Carla", member_ids=ids[1:3])],
    )
    await room.insert()
    print(f"Stanza demo creata: /stanze/{room.id}")
    print(f"Accesso di prova come admin: {admin_email}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "anna@example.test"))
