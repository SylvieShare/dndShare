"""Both gesture origins must stay inside the wide sheet center pager."""
import unittest
import xml.etree.ElementTree as ET
from character import verify_swipes


class WidePagerDevice:
    def __init__(self):
        self.section = 'weapons'
        self.gestures = []

    def wait(self, text):
        if text == 'Оружие':
            return ET.fromstring('<hierarchy><node text="Оружие" bounds="[714,328][762,349]" /></hierarchy>')
        expected = 'magic' if text == 'ЯЧЕЙКИ ЗАКЛИНАНИЙ' else 'weapons'
        if self.section != expected:
            raise AssertionError('Swipe must change the visible center page')

    def shell(self, *command):
        if command[:2] != ('input', 'swipe'):
            raise AssertionError(command)
        start, end = int(command[2]), int(command[4])
        # Sidebar, stats and utility columns do not belong to this pager.
        if not (692 < start < 1392 and 692 < end < 1392):
            raise AssertionError('Gesture left the center pager')
        self.gestures.append(command)
        self.section = 'magic' if end < start else 'weapons'


class WideSwipeTest(unittest.TestCase):
    def test_forward_and_reverse_start_inside_the_same_pager(self):
        device = WidePagerDevice()
        result = verify_swipes(device, {'name': 'wide', 'width': 1920, 'height': 1000})
        self.assertTrue(result['realHorizontalGesture'])
        self.assertEqual(len(device.gestures), 2)
        self.assertEqual(device.section, 'weapons')
