"""Measured water surfaces at independent heights, in original sculpt millimetres."""
import numpy as np


def water_surface_bands(positions, bands):
    coverage = np.zeros(len(positions), np.float32)
    height = np.zeros(len(positions), np.float32)
    for band in bands:
        lo, hi = band['minZMM'], band['maxZMM']
        low, high = band['lowZMM'], band['highZMM']
        fade = band.get('heightFadeMM', .1)
        if hi <= lo or high <= low or fade <= 0:
            raise ValueError('Ordered water band and colour heights required')
        z = positions[:, 2]
        weight = np.clip(np.minimum(z-lo, hi-z)/fade, 0, 1)
        if band.get('boundsXYMM'):
            xy_lo, xy_hi = np.array(band['boundsXYMM'])
            weight *= np.all((positions[:, :2] >= xy_lo) & (positions[:, :2] <= xy_hi), axis=1)
        selected = weight > coverage
        height = np.where(selected, np.clip((z-low)/(high-low), 0, 1), height)
        coverage = np.maximum(coverage, weight)
    return coverage, height
