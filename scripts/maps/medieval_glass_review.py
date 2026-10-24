"""Palette verification for decoded packed glass pixels, independent of hue."""
import math

CHROMATICITY_TOLERANCE = .035


def expected_glass_rgb(colour):
    if len(colour) != 3 or not all(math.isfinite(c) and 0 <= c <= 1 for c in colour):
        raise ValueError('Finite glass RGB required')
    result = []
    for c in colour:
        linear = (c / 12.92 if c <= .04045 else ((c + .055) / 1.055)**2.4)*.9
        result.append(linear*12.92 if linear <= .0031308 else 1.055*linear**(1/2.4)-.055)
    return result


def glass_chromaticity_error(actual, expected):
    if any(len(v) != 3 or not all(math.isfinite(c) and 0 <= c <= 1 for c in v) for v in [actual, expected]):
        raise ValueError('Finite glass RGB required')
    a, b = sum(actual), sum(expected)
    if min(a, b) < .02:
        return math.inf
    return max(abs(c/a-d/b) for c, d in zip(actual, expected))
