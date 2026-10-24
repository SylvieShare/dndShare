import unittest
from medieval_placement import native_to_local, placement_samples, placement_ray_tops, model_blockers


class PlacementCoordinates(unittest.TestCase):
    def setUp(self):
        self.recipe = {'width': 1, 'height': 1, 'mountCenterMM': [0, 0], 'standCells': [[0, 0]]}

    def test_northeast_free_floor_is_not_the_south_counter(self):
        self.assertEqual(native_to_local(self.recipe, [8.75, 8.75]), [.75, .25])
        self.assertEqual(placement_samples({**self.recipe, 'standPointsMM': [[8.75, 8.75]]}),
                         [(.75, .25, 8.75, 8.75)])

    def test_negative_native_y_blocker_is_the_southern_strip(self):
        polygon = [[-17.5, -3.85], [17.5, -3.85], [17.5, -17.5], [-17.5, -17.5]]
        self.assertEqual(model_blockers({**self.recipe, 'blockersMM': [polygon]}),
                         [[[0, .61], [1, .61], [1, 1], [0, 1]]])

    def test_offset_multicell_footprint_and_legacy_points(self):
        recipe = {**self.recipe, 'width': 2, 'height': 3, 'mountCenterMM': [10, -5]}
        self.assertEqual(native_to_local(recipe, [27.5, 30]), [1.5, .5])
        legacy = {**self.recipe, 'standPoints': [[.5, .214286]]}
        self.assertAlmostEqual(placement_samples(legacy)[0][3], 10, places=4)
        self.assertEqual(placement_samples(self.recipe), [(.5, .5, 0, 0)])

    def test_ambiguous_sources_are_rejected(self):
        with self.assertRaises(ValueError):
            placement_samples({**self.recipe, 'standPoints': [], 'standPointsMM': []})
        with self.assertRaises(ValueError):
            model_blockers({**self.recipe, 'blockers': [], 'blockersMM': []})

    def test_two_storeys_keep_independent_native_ray_heights(self):
        recipe = {**self.recipe, 'standPointsMM': [[0, 0], [0, 0]],
                  'mountDepthMM': 17, 'standRayTopsMM': [40, 140]}
        samples = placement_samples(recipe)
        self.assertEqual(samples[0], samples[1])
        self.assertEqual(placement_ray_tops(recipe, len(samples)), [40, 140])
        self.assertEqual(placement_ray_tops({'standRayTopMM': 40}, 2), [40, 40])

    def test_invalid_storey_measurements_are_rejected(self):
        for tops in [[40], [40, float('nan')], [40, float('inf')], [40, True], [40, 17]]:
            with self.assertRaises(ValueError):
                placement_ray_tops({'mountDepthMM': 17, 'standRayTopsMM': tops}, 2)


if __name__ == '__main__':
    unittest.main()
