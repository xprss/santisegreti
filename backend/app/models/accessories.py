from enum import StrEnum


class Accessory(StrEnum):
    """Accessori dell'omino di pan di zenzero: uno solo per persona, oppure nessuno.

    Gli id devono restare allineati con il catalogo del frontend
    (frontend/src/accessories/catalog.ts), che ne contiene anche i disegni.
    """

    SANTA_HAT = "santa_hat"
    ELF_HAT = "elf_hat"
    REINDEER_ANTLERS = "reindeer_antlers"
    BASEBALL_CAP = "baseball_cap"
    WITCH_HAT = "witch_hat"
    TOP_HAT = "top_hat"
    CROWN = "crown"
    HALO = "halo"
    HEADPHONES = "headphones"
    CLOWN_WIG = "clown_wig"
    PUNK_MOHAWK = "punk_mohawk"
    MUSTACHE = "mustache"
    GLASSES = "glasses"
    SUNGLASSES = "sunglasses"
    SKI_GOGGLES = "ski_goggles"
    TIE = "tie"
    BOW_TIE = "bow_tie"
    SCARF = "scarf"
    CROSSBODY_BAG = "crossbody_bag"
    SCHOOL_BACKPACK = "school_backpack"
