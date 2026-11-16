import re
from pathlib import Path

import pytest

from app.models import Accessory
from app.models.accessories import SPECIAL_ACCESSORIES

CATALOG = Path(__file__).resolve().parents[2] / "frontend" / "src" / "accessories" / "catalog.ts"


def test_frontend_catalog_matches_backend_enum():
    if not CATALOG.exists():
        pytest.skip("frontend non presente")
    source = CATALOG.read_text()
    union = source.split("export type AccessoryId =", 1)[1].split("\n\n", 1)[0]
    type_ids = set(re.findall(r"'([a-z_]+)'", union))
    # Le voci del catalogo hanno `id:` su una riga a sé (i gruppi no).
    catalog_ids = set(re.findall(r"^\s+id: '([a-z_]+)',$", source, flags=re.MULTILINE))
    backend_ids = {a.value for a in Accessory}
    assert type_ids == backend_ids
    assert catalog_ids == backend_ids


def test_special_accessories_match_frontend_catalog():
    if not CATALOG.exists():
        pytest.skip("frontend non presente")
    source = CATALOG.read_text()
    # Ogni voce del catalogo è un blocco che parte da `id:`; le speciali hanno `special: true`.
    entries = re.split(r"^\s+id: '", source, flags=re.MULTILINE)[1:]
    special = {
        e.split("'", 1)[0]
        for e in entries
        if re.search(r"^\s+special: true,$", e.split("\n  },", 1)[0], flags=re.MULTILINE)
    }
    assert special == {a.value for a in SPECIAL_ACCESSORIES}
