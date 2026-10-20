"""Apply measured native-frame seating to the existing support-slot contract."""
import copy
import json
import math
from pathlib import Path


def apply_recess_profiles(slots, row, directory=None):
    result = copy.deepcopy(slots)
    directory = Path(directory) if directory else Path(__file__).parent/'recess-frame-fits'
    for file in sorted(directory.glob('*.json')):
        record = json.loads(file.read_text())
        if record['schemaVersion'] != 1:
            raise ValueError('Unknown recessed frame-fit schema')
        frame = next((f for f in record['frames'] if f['code']==row['code']), None)
        if not frame or frame['sourceSHA256']!=row['sourceSHA256']:
            raise ValueError('Native frame identity differs from its recess fit')
        locations = {(s['x'], s['y']) for s in frame['slots']}
        if len(locations) != len(frame['slots']):
            raise ValueError('Duplicate measured frame cells')
        width = round((row['max'][0]-row['min'][0])/35)
        height = round((row['max'][1]-row['min'][1])/35)
        for cell in frame['slots']:
            expected = [(cell['x']-(width-1)/2)*35, ((height-1)/2-cell['y'])*35]
            if any(abs(a-c)>.0001 for a, c in zip(cell['centerMM'], expected)):
                raise ValueError('Measured frame cells use the wrong local/native axes')
        for slot in result:
            cells = {(x, y) for x in range(slot['x'], slot['x']+slot['width'])
                     for y in range(slot['y'], slot['y']+slot['height'])}
            if not cells.issubset(locations):
                raise ValueError('Support slot contains an unmeasured recess cell')
            seat = max(s['verifiedSeatMM'] for s in frame['slots'] if (s['x'], s['y']) in cells)
            rise = max(0, seat/35-slot['elevation'])
            if rise>.15:
                raise ValueError('Measured recess seating exceeds the support-slot range')
            slot.setdefault('insertionRises', {})[record['profile']] = math.ceil(rise*1e6)/1e6
    return result
