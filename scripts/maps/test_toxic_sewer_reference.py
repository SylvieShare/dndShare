"""Reference surfaces may have no upright wall, as with a low water tile."""
import unittest
import numpy as np
from toxic_sewer_reference import projected_grid


class ReferenceGridTests(unittest.TestCase):
    def test_low_water_has_no_wall_interval(self):
        grid = projected_grid(np.empty((0, 3, 3)), [0, 2], 1,
                              [-17.5, 14.25], [17.5, 12.4153], .2, False)
        self.assertEqual(grid['size'], [0, 0])
        self.assertEqual(grid['values'], [])

    def test_empty_valid_interval_is_nullable(self):
        grid = projected_grid(np.empty((0, 3, 3)), [0, 1], 2,
                              [0, 0], [1, 1], 1, True)
        self.assertEqual(grid['size'], [2, 2])
        self.assertEqual(grid['values'], [None]*4)


if __name__ == '__main__':
    unittest.main()
