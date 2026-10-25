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
    receivers = directory/'receivers'; receivers.mkdir()
    file = directory/'MT1-080.json'
    file.write_text(json.dumps(record))
    result = apply_recess_profiles(slots, row, directory, receivers)
    assert abs(result[0]['insertionRises'][record['profile']]-4/35)<1e-6
    assert result[0]['insertionRises']['legacy']==.01
    assert record['profile'] not in slots[0]['insertionRises']
    single = [{**slots[0], 'width': 1}]
    assert abs(apply_recess_profiles(single, row, directory, receivers)[0]['insertionRises'][record['profile']]-3/35)<1e-6
    for bad_row, bad_slots in [({**row, 'sourceSHA256': 'e'*64}, slots), (row, [{**slots[0], 'width': 3}])]:
        try:
            apply_recess_profiles(bad_slots, bad_row, directory, receivers)
        except ValueError:
            pass
        else:
            raise AssertionError('Unverified frame seating was accepted')
print('RECESS_FRAME_PROFILES_TEST_PASS')

# Receiving models such as Level have their own measured cells, rather than a
# silent fallback when the historical bonus-frame table has no matching row.
import copy
import math
standard = json.loads((Path(__file__).parent/'standard-mount-profile.json').read_text())
receiver_row = dict(code='MT1-086', sourceSHA256='a'*64, min=[-35,-17.5,0], max=[35,17.5,40])
key = 'ud016-recess-mt1-080-v1'
receiver_slots = [dict(x=0,y=0,width=2,height=1,elevation=40/35,insertionRises={'legacy':.01})]
receiver_record = dict(schemaVersion=1,sourceCode='MT1-086',sourceSHA256='a'*64,reference=standard,
    profiles=[dict(profile=standard['name']),dict(profile=key)],cells=[
        dict(x=0,y=0,centerMM=[-17.5,0],seatsMM={standard['name']:41,key:41.8}),
        dict(x=1,y=0,centerMM=[17.5,0],seatsMM={standard['name']:41.5,key:42.2})])
with tempfile.TemporaryDirectory() as temp:
    path=Path(temp);old=path/'old';receivers=path/'receivers';old.mkdir();receivers.mkdir()
    (old/'profile.json').write_text(json.dumps(dict(profile=key)))
    file=receivers/'MT1-086.json';file.write_text(json.dumps(receiver_record))
    value=apply_recess_profiles(receiver_slots,receiver_row,old,receivers)[0]
    assert value['insertionRise']==math.ceil(1.5/35*1e6)/1e6
    assert value['insertionRises'][key]==math.ceil(2.2/35*1e6)/1e6
    assert value['insertionRises']['legacy']==.01
    assert 'insertionRise' not in receiver_slots[0]
    invalid=[]
    for field,value in [('sourceSHA256','b'*64),('sourceCode','MT1-087'),('schemaVersion',2)]:
        bad=copy.deepcopy(receiver_record);bad[field]=value;invalid.append(bad)
    bad=copy.deepcopy(receiver_record);bad['profiles']=bad['profiles'][:1];invalid.append(bad)
    bad=copy.deepcopy(receiver_record);bad['cells'][1]['centerMM']=[-17.5,0];invalid.append(bad)
    bad=copy.deepcopy(receiver_record);bad['cells']=bad['cells'][:1];invalid.append(bad)
    bad=copy.deepcopy(receiver_record);bad['cells'][0]['seatsMM'][key]=float('nan');invalid.append(bad)
    bad=copy.deepcopy(receiver_record);bad['cells'][0]['seatsMM'][key]=46;invalid.append(bad)
    for bad in invalid:
        file.write_text(json.dumps(bad))
        try:apply_recess_profiles(receiver_slots,receiver_row,old,receivers)
        except ValueError:pass
        else:raise AssertionError('Invalid receiving-frame evidence was accepted')
print('RECEIVER_FRAME_PROFILES_TEST_PASS')
