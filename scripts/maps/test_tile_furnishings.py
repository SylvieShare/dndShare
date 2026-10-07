import unittest
from tile_furnishings import has_furnishings


class FurnishingsTest(unittest.TestCase):
    def test_built_in_content_is_present_even_when_the_object_itself_is_empty(self):
        for name in ["Ground Table Empty", "Ground Table Full", "Ground Bench",
                     "Well Ground Empty", "Fountain Crystal", "Stalagmite Ground 1",
                     "Water Rock 1", "Water With Rocks", "Pipe Water T-Shaped",
                     "Ground Tentacles", "Ground Lever", "Stair Angle Skulls"]:
            with self.subTest(name=name):
                self.assertTrue(has_furnishings("floor", name))

    def test_surface_materials_and_floor_patterns_do_not_occupy_the_tile(self):
        for name in ["Ground Wood", "Water", "Railway", "Ground Stones 1",
                     "Ground Symbol Pentacle", "Embedded Rune"]:
            with self.subTest(name=name):
                self.assertFalse(has_furnishings("floor", name))


if __name__ == "__main__":
    unittest.main()
