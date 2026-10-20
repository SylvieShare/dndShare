"""Apply measured native-frame seating to the existing support-slot contract."""
import copy
import json
import math
from pathlib import Path


def _receiver_profiles(slots, row, record, required):
    standard = json.loads((Path(__file__).parent/'standard-mount-profile.json').read_text())
    if (record.get('schemaVersion') != 1 or record.get('sourceCode') != row['code'] or
            record.get('sourceSHA256') != row['sourceSHA256'] or record.get('reference') != standard):
        raise ValueError('Receiving frame identity or UD-016 reference differs')
    keys = [p['profile'] for p in record['profiles']]
    if len(keys) != len(set(keys)) or set(keys) != required | {standard['name']}:
        raise ValueError('Receiving frame does not cover every measured insertion profile')
    width = round((row['max'][0]-row['min'][0])/35)
    height = round((row['max'][1]-row['min'][1])/35)
    cells = {}
    for cell in record['cells']:
        x, y = cell['x'], cell['y']
        expected = [(x-(width-1)/2)*35, ((height-1)/2-y)*35]
        if ((x, y) in cells or not (0 <= x < width and 0 <= y < height) or
                any(abs(a-c)>.0001 for a, c in zip(cell['centerMM'], expected)) or
                len(cell['centerMM']) != 2 or set(cell['seatsMM']) != set(keys) or
                any(not math.isfinite(v) for v in cell['seatsMM'].values())):
            raise ValueError('Invalid receiving frame cells, coordinates or seating')
        cells[x, y] = cell
    result = copy.deepcopy(slots)
    for slot in result:
        locations = {(x, y) for x in range(slot['x'], slot['x']+slot['width'])
                     for y in range(slot['y'], slot['y']+slot['height'])}
        if not locations or not locations.issubset(cells):
            raise ValueError('Receiving support slot contains an unmeasured cell')
        for key in keys:
            seat = max(cells[p]['seatsMM'][key] for p in locations)
            rise = seat/35-slot['elevation']
            if not math.isfinite(rise) or not 0 <= rise <= .15:
                raise ValueError('Receiving frame seating exceeds the supported range')
            value = math.ceil(rise*1e6)/1e6
            if key == standard['name']:
                slot['insertionRise'] = value
            else:
                slot.setdefault('insertionRises', {})[key] = value
    return result


def apply_recess_profiles(slots, row, directory=None, receiver_directory=None):
    result = copy.deepcopy(slots)
    directory = Path(directory) if directory else Path(__file__).parent/'recess-frame-fits'
    files = sorted(directory.glob('*.json'))
    receiver_directory = Path(receiver_directory) if receiver_directory else Path(__file__).parent/'receiver-frame-fits'
    receiver = receiver_directory/(row['code']+'.json')
    if receiver.exists():
        required = {json.loads(file.read_text())['profile'] for file in files}
        return _receiver_profiles(slots, row, json.loads(receiver.read_text()), required)
    for file in files:
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
