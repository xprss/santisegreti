import random
from itertools import combinations

import pytest

from app.services.matching import MatchingError, draw


def assert_valid(pairs: dict, participants: list, groups: list[list]) -> None:
    assert set(pairs) == set(participants), "ognuno regala"
    assert sorted(pairs.values()) == sorted(participants), "ognuno riceve una volta sola"
    for giver, receiver in pairs.items():
        assert giver != receiver
    for group in groups:
        for a, b in combinations(group, 2):
            assert pairs[a] != b and pairs[b] != a


def is_single_cycle(pairs: dict) -> bool:
    start = next(iter(pairs))
    seen, current = set(), start
    while current not in seen:
        seen.add(current)
        current = pairs[current]
    return len(seen) == len(pairs)


def test_needs_three_people():
    with pytest.raises(MatchingError):
        draw(["a", "b"])


def test_duplicates_are_ignored():
    with pytest.raises(MatchingError):
        draw(["a", "a", "b"])


def test_three_people_make_a_cycle():
    pairs = draw(["a", "b", "c"], rng=random.Random(1))
    assert_valid(pairs, ["a", "b", "c"], [])
    assert is_single_cycle(pairs)


@pytest.mark.parametrize("seed", range(200))
def test_random_instances_are_valid_and_single_cycle(seed: int):
    rng = random.Random(seed)
    people = list(range(rng.randint(3, 40)))
    groups = []
    for _ in range(rng.randint(0, len(people) // 3)):
        groups.append(rng.sample(people, rng.randint(2, 3)))
    try:
        pairs = draw(people, groups, rng=rng)
    except MatchingError:
        # Accettabile solo se davvero qualcuno resta senza opzioni o i vincoli sono stretti:
        # con pochi gruppi piccoli su tanta gente non deve succedere.
        assert len(people) < 8
        return
    assert_valid(pairs, people, groups)
    if len(people) >= 6:
        assert is_single_cycle(pairs)


def test_couples_never_draw_each_other():
    people = ["anna", "bruno", "carla", "dario", "elena", "fabio"]
    groups = [["anna", "bruno"], ["carla", "dario"], ["elena", "fabio"]]
    for seed in range(50):
        pairs = draw(people, groups, rng=random.Random(seed))
        assert_valid(pairs, people, groups)
        assert is_single_cycle(pairs)


def test_person_excluded_from_everyone_fails():
    people = ["a", "b", "c", "d"]
    with pytest.raises(MatchingError):
        draw(people, [["a", "b", "c", "d"]])


def test_impossible_matching_fails():
    # a, b, c non possono scambiarsi tra loro e d da solo non basta a ricevere da tre persone.
    with pytest.raises(MatchingError):
        draw(["a", "b", "c", "d"], [["a", "b", "c"]])


def test_falls_back_to_multiple_cycles_when_needed():
    # Due famiglie da due: l'unico modo è che si scambino tra famiglie.
    # Un ciclo unico esiste (a→c→b→d→a), quindi deve trovarlo.
    people = ["a", "b", "c", "d"]
    groups = [["a", "b"], ["c", "d"]]
    for seed in range(20):
        pairs = draw(people, groups, rng=random.Random(seed))
        assert_valid(pairs, people, groups)
        assert is_single_cycle(pairs)


def test_uses_every_option_over_many_draws():
    people = ["a", "b", "c", "d", "e"]
    seen = {draw(people, rng=random.Random(seed))["a"] for seed in range(200)}
    assert seen == {"b", "c", "d", "e"}
