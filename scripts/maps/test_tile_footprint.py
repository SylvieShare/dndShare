import unittest
import numpy as np
from tile_footprint import footprint


def box(width, height, top):
    vertices = np.array([[x, y, z] for z in [0, top]
                         for y in [-height/2, height/2]
                         for x in [-width/2, width/2]], dtype=float)
    faces = [[0, 1, 3], [0, 3, 2], [4, 6, 7], [4, 7, 5],
             [0, 4, 5], [0, 5, 1], [2, 3, 7], [2, 7, 6],
             [0, 2, 6], [0, 6, 4], [1, 5, 7], [1, 7, 3]]
    return vertices[faces]


class FootprintTests(unittest.TestCase):
    def test_decorative_overhang_uses_one_base_cell_and_its_mount_center(self):
        row = {'min': [-17.5, -17.5, 0], 'max': [17.5, 87.5, 60],
               'cutHeight': 0, 'mountDepth': 1}
        self.assertEqual(footprint(row, box(35, 35, 40)),
                         {'width': 1, 'height': 1, 'placementOffset': [0, -1]})

    def test_real_three_cell_bridge_keeps_its_footprint(self):
        row = {'min': [-17.5, -52.5, 0], 'max': [17.5, 52.5, 60],
               'cutHeight': 0, 'mountDepth': 1}
        self.assertEqual(footprint(row, box(35, 105, 40)),
                         {'width': 1, 'height': 3, 'placementOffset': [0, 0]})

    def test_unmounted_structural_mesh_keeps_its_dimensions(self):
        row = {'min': [-52.5, -105, 0], 'max': [52.5, 105, 60],
               'cutHeight': 0, 'mountDepth': 0}
        self.assertEqual(footprint(row, box(105, 210, 40)),
                         {'width': 3, 'height': 6, 'placementOffset': [0, 0]})


if __name__ == '__main__':
    unittest.main()
