import copy
import json
import tempfile
import unittest
from pathlib import Path
from token_model import load, validate, digest, media_queries
from token_render import render


class TokenContractTests(unittest.TestCase):
    def test_change_has_one_value_in_both_platform_outputs(self):
        data = load()
        data['collection']['min-height'] = 176
        data['motion']['navigation'] = 227
        data['typography']['collection-title']['size'] = 24
        outputs = render(validate(data), 'fixture')
        css = next(value for key, value in outputs.items() if key.endswith('.css'))
        compose = next(value for key, value in outputs.items() if key.endswith('.kt'))
        self.assertIn('--collection-min-height: 176px;', css)
        self.assertIn('val MinHeight = 176.dp', compose)
        self.assertIn('--motion-navigation: 227ms;', css)
        self.assertIn('val Navigation = 227', compose)
        self.assertIn('--type-collection-title-size: 24px;', css)
        self.assertIn('val CollectionTitle = DesignType(24.sp', compose)

    def test_window_boundaries_move_together(self):
        data = load()
        data['layout']['tablet'] = 700
        self.assertEqual(media_queries(validate(data))['--ui-phone'], '(width < 700px)')
        self.assertEqual(media_queries(data)['--ui-tablet'], '(700px <= width < 1200px)')

    def test_invalid_accessibility_geometry_and_fonts_fail_early(self):
        for group, name, value in [('layout', 'sheet-stats-column-min', 320), ('layout', 'touch-min', 40), ('layout', 'tablet', 1200),
                                   ('collection', 'min-height', 16), ('canvas', 'opacity', 2),
                                   ('list', 'metric-min', 100), ('list', 'icon', 100),
                                   ('motion', 'enter', 1.5), ('spacing', 'xs', True), ('radius', 'tile', float('nan'))]:
            data = copy.deepcopy(load())
            data[group][name] = value
            with self.subTest(group=group, name=name), self.assertRaises(ValueError):
                validate(data)
        data = load()
        data['typography']['title']['weight'] = 800
        with self.assertRaisesRegex(ValueError, 'Display font'):
            validate(data)

    def test_font_weights_match_web_face_ranges(self):
        for role, rejected in [('title', 400), ('body', 800)]:
            data = load()
            data['typography'][role]['weight'] = rejected
            with self.subTest(role=role), self.assertRaisesRegex(ValueError, 'font supports weights'):
                validate(data)
        for role, accepted in [('title', (500, 600, 700)), ('body', (400, 500, 600, 700))]:
            for weight in accepted:
                data = load()
                data['typography'][role]['weight'] = weight
                validate(data)

    def test_duplicate_keys_are_not_silently_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'tokens.json'
            path.write_text('{"schemaVersion":1,"schemaVersion":2}')
            with self.assertRaisesRegex(ValueError, 'Duplicate'):
                load(path)

    def test_source_hash_is_stable_across_platform_line_endings(self):
        self.assertEqual(digest(b'one\ntwo\n'), digest(b'one\r\ntwo\r\n'))


if __name__ == '__main__':
    unittest.main()
