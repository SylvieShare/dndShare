"""Input hit testing must honor scroll clipping reported by UIAutomator."""
import unittest
import xml.etree.ElementTree as ET
from native_controls import visible_input_bounds


class VisibleInputTest(unittest.TestCase):
    def test_partially_visible_field_does_not_hit_footer(self):
        root = ET.fromstring('<hierarchy><node bounds="[12,100][378,840]"><node scrollable="true" bounds="[32,190][358,780]"><node class="android.widget.EditText" bounds="[32,773][358,821]" /></node></node></hierarchy>')
        field = next(n for n in root.iter('node') if n.get('class'))
        self.assertEqual(visible_input_bounds(root, field), '[32,773][358,780]')

    def test_fully_clipped_input_is_rejected(self):
        root = ET.fromstring('<hierarchy><node bounds="[0,0][390,500]"><node bounds="[10,600][380,650]" /></node></hierarchy>')
        with self.assertRaisesRegex(AssertionError, 'no visible'):
            visible_input_bounds(root, list(root.iter('node'))[-1])
