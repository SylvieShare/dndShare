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


class ExternalCaptionTest(unittest.TestCase):
    def test_enter_uses_the_editable_inside_its_description_instead_of_the_caption(self):
        from native_controls import NativeControls
        class Device:
            tapped = None
            typed = None
            def tree(self):
                return ET.fromstring('<hierarchy><node bounds="[0,0][390,900]"><node text="Количество" bounds="[0,0][80,20]"/><node class="android.widget.EditText" text="12" bounds="[100,40][148,60]"/><node content-desc="Количество" bounds="[72,32][176,68]"/></node></hierarchy>')
            def shell(self,*command):
                if command[:2] == ('input','text'):self.typed=command[2]
                return ''
            def tap(self,node):self.tapped=node.get('bounds')
        device=Device()
        NativeControls(device).enter('Количество','37')
        self.assertEqual(device.tapped,'[100,40][148,60]')
        self.assertEqual(device.typed,'37')
