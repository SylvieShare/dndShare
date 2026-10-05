"""Measured timber bounds in cropped STL millimetres, shared with UV painting."""
import json
from pathlib import Path
import numpy as np

SPEC = json.loads(Path(__file__).with_name('ud006-material.json').read_text())


def timber_parts(x, y, z):
    result = np.zeros(np.shape(x), dtype=np.uint8)
    for index, name in [(3, 'foot'), (2, 'brace'), (1, 'post')]:
        spec = SPEC[name]
        mask = np.ones(np.shape(x), dtype=bool)
        for axis, values in enumerate([x, y, z]):
            mask &= (values>=spec['min'][axis]) & (values<=spec['max'][axis])
        result[mask] = index
    return result
