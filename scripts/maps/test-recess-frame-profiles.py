import json
import tempfile
from pathlib import Path
from recess_frame_profiles import apply_recess_profiles

row = dict(code='MT1-712', sourceSHA256='f'*64, min=[-35,-17.5,0], max=[35,17.5,25])
record = dict(schemaVersion=1, profile='ud016-recess-mt1-080-v1', frames=[
    dict(code=row['code'], sourceSHA256=row['sourceSHA256'], slots=[
        dict(x=0, y=0, centerMM=[-17.5,0], verifiedSeatMM=28),
        dict(x=1, y=0, centerMM=[17.5,0], verifiedSeatMM=29)])])
slots = [dict(x=0, y=0, width=2, height=1, elevation=25/35, insertionRises={'legacy': .01})]
with tempfile.TemporaryDirectory() as temp:
    directory = Path(temp)
    file = directory/'MT1-080.json'
    file.write_text(json.dumps(record))
    result = apply_recess_profiles(slots, row, directory)
    assert abs(result[0]['insertionRises'][record['profile']]-4/35)<1e-6
    assert result[0]['insertionRises']['legacy']==.01
    assert record['profile'] not in slots[0]['insertionRises']
    single = [{**slots[0], 'width': 1}]
    assert abs(apply_recess_profiles(single, row, directory)[0]['insertionRises'][record['profile']]-3/35)<1e-6
    for bad_row, bad_slots in [({**row, 'sourceSHA256': 'e'*64}, slots), (row, [{**slots[0], 'width': 3}])]:
        try:
            apply_recess_profiles(bad_slots, bad_row, directory)
        except ValueError:
            pass
        else:
            raise AssertionError('Unverified frame seating was accepted')
print('RECESS_FRAME_PROFILES_TEST_PASS')
