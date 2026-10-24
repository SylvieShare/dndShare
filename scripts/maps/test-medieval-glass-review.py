"""Packed glass pigment checks accept the declared hue and reject timber/grey."""
import unittest
from medieval_glass_review import expected_glass_rgb, glass_chromaticity_error, CHROMATICITY_TOLERANCE


class GlassPaletteTest(unittest.TestCase):
    def test_measured_green(self):
        actual = [.4639398578, .5698222045, .1649067486]
        self.assertLess(glass_chromaticity_error(actual, expected_glass_rgb([.48, .59, .17])), CHROMATICITY_TOLERANCE)

    def test_amber_and_wrong_pigments(self):
        expected = expected_glass_rgb([.78, .55, .08])
        self.assertEqual(glass_chromaticity_error(expected, expected), 0)
        for actual in [[.4, .4, .4], [.5, .28, .1], [.2, .6, .15], [0, 0, 0]]:
            self.assertGreater(glass_chromaticity_error(actual, expected), CHROMATICITY_TOLERANCE)


if __name__ == '__main__':
    unittest.main()
