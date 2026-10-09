"""Independent pool heights must not turn intervening horizontal rock into water."""
import numpy as np
from water_surface_bands import water_surface_bands


bands = [
    {'minZMM': 25, 'maxZMM': 25.6, 'lowZMM': 25.1, 'highZMM': 25.5,
     'boundsXYMM': [[-20, -10], [40, 40]]},
    {'minZMM': 56.2, 'maxZMM': 56.9, 'lowZMM': 56.3, 'highZMM': 56.7,
     'boundsXYMM': [[0, -45], [40, -5]]},
]
positions = np.array([[10, 0, 25.3], [10, -20, 56.5], [10, 0, 40],
                      [10, 0, 56.5], [50, 0, 25.3], [10, 0, 25.05]], np.float32)
before = positions.copy()
weight, height = water_surface_bands(positions, bands)
np.testing.assert_allclose(weight, [1, 1, 0, 0, 0, .5], atol=1e-5)
np.testing.assert_allclose(height[:2], [.5, .5], atol=1e-5)
np.testing.assert_array_equal(positions, before)
np.testing.assert_array_equal(water_surface_bands(positions, [])[0], np.zeros(len(positions)))
try:
    water_surface_bands(positions, [{'minZMM': 2, 'maxZMM': 1, 'lowZMM': 0, 'highZMM': 1}])
except ValueError:
    pass
else:
    raise AssertionError('Reversed band must be rejected')
print('WATER_SURFACE_BANDS_VALIDATED')
