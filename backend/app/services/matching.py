"""Estrazione del Secret Santa.

Funzione pura: riceve i partecipanti e i gruppi di esclusione, restituisce chi regala a chi.

Ordine dei tentativi:
1. un ciclo unico (A → B → C → … → A): la catena classica, in cui nessuna coppia si regala a
   vicenda e quindi nessuno può dedurre chi gli fa il regalo;
2. se le esclusioni lo rendono impossibile, un abbinamento qualsiasi in cui ognuno regala a una
   persona e riceve da un'altra (possono formarsi più catene separate);
3. se nemmeno questo esiste, MatchingError.
"""

import random
from collections.abc import Hashable, Iterable, Sequence
from itertools import combinations

MIN_PARTICIPANTS = 3
_CYCLE_ATTEMPTS = 8
_CYCLE_STEP_BUDGET = 20_000


class MatchingError(Exception):
    pass


def draw[T: Hashable](
    participants: Sequence[T],
    exclusion_groups: Iterable[Iterable[T]] = (),
    rng: random.Random | None = None,
) -> dict[T, T]:
    rng = rng or random.SystemRandom()
    nodes = list(dict.fromkeys(participants))
    if len(nodes) < MIN_PARTICIPANTS:
        raise MatchingError(f"Per l'estrazione servono almeno {MIN_PARTICIPANTS} partecipanti.")

    forbidden: set[tuple[T, T]] = set()
    for group in exclusion_groups:
        for a, b in combinations(set(group), 2):
            forbidden.add((a, b))
            forbidden.add((b, a))

    allowed = {a: [b for b in nodes if b != a and (a, b) not in forbidden] for a in nodes}
    lonely = [a for a, options in allowed.items() if not options]
    if lonely:
        raise MatchingError(
            "Con queste esclusioni qualcuno non ha nessuno a cui fare il regalo. "
            "Proviamo ad allentare un gruppo?"
        )

    for _ in range(_CYCLE_ATTEMPTS):
        cycle = _find_cycle(nodes, allowed, rng)
        if cycle is not None:
            return {cycle[i]: cycle[(i + 1) % len(cycle)] for i in range(len(cycle))}

    matching = _find_matching(nodes, allowed, rng)
    if matching is not None:
        return matching

    raise MatchingError(
        "Con queste esclusioni non c'è modo di far quadrare i conti: "
        "qualcuno resterebbe senza regalo. Proviamo ad allentare un gruppo?"
    )


def _shuffled[T](items: Iterable[T], rng: random.Random) -> list[T]:
    out = list(items)
    rng.shuffle(out)
    return out


def _find_cycle[T](nodes: list[T], allowed: dict[T, list[T]], rng: random.Random) -> list[T] | None:
    """Ciclo hamiltoniano casuale con backtracking e budget di passi."""
    order = _shuffled(nodes, rng)
    start = order[0]
    path = [start]
    visited = {start}
    stack = [iter(_shuffled(allowed[start], rng))]
    steps = 0

    while stack:
        steps += 1
        if steps > _CYCLE_STEP_BUDGET:
            return None
        if len(path) == len(nodes):
            if start in allowed[path[-1]]:
                return path
            stack.pop()
            visited.discard(path.pop())
            continue
        nxt = next(stack[-1], None)
        if nxt is None:
            stack.pop()
            visited.discard(path.pop())
            continue
        if nxt in visited:
            continue
        path.append(nxt)
        visited.add(nxt)
        stack.append(iter(_shuffled(allowed[nxt], rng)))
    return None


def _find_matching[T](
    nodes: list[T], allowed: dict[T, list[T]], rng: random.Random
) -> dict[T, T] | None:
    """Abbinamento perfetto chi regala → chi riceve (algoritmo di Kuhn su ordini casuali)."""
    giver_of: dict[T, T] = {}

    def assign(giver: T, seen: set[T]) -> bool:
        for receiver in _shuffled(allowed[giver], rng):
            if receiver in seen:
                continue
            seen.add(receiver)
            if receiver not in giver_of or assign(giver_of[receiver], seen):
                giver_of[receiver] = giver
                return True
        return False

    for giver in _shuffled(nodes, rng):
        if not assign(giver, set()):
            return None
    return {giver: receiver for receiver, giver in giver_of.items()}
