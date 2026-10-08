"""Run with the bundled NumPy Python; no source model files are required."""
from pathlib import Path
import sys
import numpy as np
sys.path.insert(0, str(Path(__file__).parent))
from majestic_waterfall import apply_waterfall

points = np.array([[35, 0, 25], [35, 15, 25], [44, 0, 25], [35, 0, 5]], float)
colour = np.tile([.5, .3, .15], (4, 1))
roughness = np.full(4, .93)
recipe = {'waterfall': {'profileXZMM': [[30, 15], [40, 35]], 'widthMM': 4,
    'minYMM': -20, 'maxYMM': 20, 'minZMM': 15, 'maxZMM': 35,
    'lowerRGB': [.1, .5, .55], 'upperRGB': [.4, .7, .75],
    'rockExclusions': [{'centreMM': [35, 0, 25], 'radiiMM': [3, 3, 3]}]}}
painted, changed_roughness = apply_waterfall(points, colour.copy(), roughness.copy(), recipe)
np.testing.assert_array_equal(painted[[0, 2, 3]], colour[[0, 2, 3]])
np.testing.assert_array_equal(changed_roughness[[0, 2, 3]], roughness[[0, 2, 3]])
assert painted[1, 2] > painted[1, 0] * 2 and changed_roughness[1] < .5
unchanged = apply_waterfall(points, colour, roughness, {})
assert unchanged[0] is colour and unchanged[1] is roughness
print('MAJESTIC_WATERFALL_TEST_PASSED')
