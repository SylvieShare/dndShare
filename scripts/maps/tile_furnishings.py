"""Classify built-in furnishings separately from surface materials and movement."""
import re

_FURNISHINGS = re.compile(
    r"\b(skulls?|bones?|mushrooms?|crystals?|chains?|bags?|barrels?|weapons|"
    r"debris|broken|tables?|bench|beds?|fountain|well|lever|tentacles|"
    r"stalagmite ground|rocks ground|water (with )?rocks?|pipe water)\b",
    re.IGNORECASE,
)


def has_furnishings(tile_type, source_name):
    return tile_type == "prop" or bool(_FURNISHINGS.search(source_name))
