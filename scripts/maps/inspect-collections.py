"""Inventory canonical, unsupported meshes without altering print originals."""
from pathlib import Path
import hashlib, json, math, re, struct
import numpy as np
from importlib.util import spec_from_file_location, module_from_spec
_spec=spec_from_file_location('measure_mounts',Path(__file__).with_name('measure-mounts.py'))
_mounts=module_from_spec(_spec);_spec.loader.exec_module(_mounts)

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'models/collections'
names={'lost-cave':'Lost Cave','ultimate-dungeon':'Ultimate Dungeon','toxic-sewer':'Toxic Sewer','basic-elements':'Basic Elements'}
terrain={'lost-cave':'cave','ultimate-dungeon':'dungeon','toxic-sewer':'sewer','basic-elements':'structure'}
paths=[]
for collection in names:
 if collection=='basic-elements':continue
 variants=BASE/collection/'variants'
 for folder in variants.iterdir():
  if folder.name.endswith('-Unsupported'):
   paths += [(collection,p) for p in folder.rglob('*.stl')]
  elif 'Bonus Blocks' in folder.name:
   paths += [(collection,p) for p in (folder/'Unsupported').glob('*.stl')]
for p in (BASE/'ultimate-dungeon/variants/Basic Elements/Unsupported').glob('*.stl'):paths.append(('basic-elements',p))
rows=[]
for collection,path in paths:
 stem=path.stem
 match=re.match(r'((?:LC|UD|TS)-\d{3})-(.*)',stem)
 code,source_name=(match.group(1),match.group(2)) if match else (stem,re.sub(r'^(LC|UD|TS)-','',stem))
 fixed=list((BASE/'lost-cave/variants/Level Grids Fixed').glob(stem+' (Fixed).stl')) if collection=='lost-cave' else []
 if fixed:path=fixed[0]
 size=path.stat().st_size
 with path.open('rb') as f:
  f.seek(80); count=struct.unpack('<I',f.read(4))[0]
 if size!=84+count*50:raise ValueError('Unexpected STL encoding: '+str(path))
 data=np.memmap(path,dtype=np.dtype([('normal','<f4',(3,)),('v','<f4',(3,3)),('attr','<u2')]),mode='r',offset=84,shape=(count,))['v']
 low=data.min(axis=(0,1)).astype(float);high=data.max(axis=(0,1)).astype(float)
 spans=high-low
 grid=re.search(r'(\d+)\s*[xX]\s*(\d+)',source_name)
 width,height=(max(1,math.ceil(spans[0]/35-.025)),max(1,math.ceil(spans[1]/35-.025)))
 text=source_name.lower()
 kind='frame' if 'level grid' in text or source_name=='Grid 3X3' else 'stairs' if any(w in text for w in ['stair','ladder']) else 'wall' if any(w in text for w in ['wall','angle','corner','door','prison']) else 'floor' if any(w in text for w in ['ground','water','railway','level']) else 'prop'
 # Structural grids retain their lower ledges and upper sockets.
 cut=low[2] if kind=='frame' or collection=='basic-elements' else low[2]+11.5
 if code in ['LC-007','LC-008','LC-009']:cut=4.6
 if kind=='floor' and high[2]-low[2]<22:cut=low[2]+4.6
 if code=='UD-104':cut=low[2]
 if high[2]<=cut+1:cut=low[2]
 with path.open('rb') as f:checksum=hashlib.file_digest(f,'sha256').hexdigest()
 row={'collection':collection,'collectionName':names[collection],'terrainType':terrain[collection],
      'code':code,'sourceName':source_name,'sourcePath':str(path.relative_to(ROOT/'models')),
      'sourceBytes':size,'sourceSHA256':checksum,'triangles':count,'min':low.tolist(),'max':high.tolist(),
      'width':width,'height':height,'cutHeight':float(cut),'tileType':kind}
 row['mountDepth'],_= _mounts.measure(row)
 rows.append(row)
rows.sort(key=lambda r:(r['collection'],r['code']))
for row in rows:
 if row['code']=='UD-055' and row['sourceName']=='Prison Cell Wall':row.update(outputSlug='UD-055__Prison_Cell_Wall',variantVersion=2)
(BASE/'manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print('MODELS',len(rows),'SOURCE_BYTES',sum(r['sourceBytes'] for r in rows),'MAX',max(r['sourceBytes'] for r in rows))
for collection in names:print(collection,sum(r['collection']==collection for r in rows))
for r in rows:
 if r['tileType'] in ['frame','stairs'] or r['width']>1 or r['height']>1:print(r['code'],r['sourceName'],r['width'],r['height'],'bounds',[round(v,2) for v in r['max']],'cut',r['cutHeight'])
