"""Build a complete, reproducible S3 manifest from prepared collection assets."""
from pathlib import Path
from tile_category import tile_category
import hashlib, json, os, uuid
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];MODELS=ROOT/'models';BASE=MODELS/'collections/prepared';OUT=MODELS/'collections/upload'
OUT.mkdir(parents=True,exist_ok=True)

def asset(path,mime,extension):
 with path.open('rb') as f:sha=hashlib.file_digest(f,'sha256').hexdigest()
 name=sha+'.'+extension;dest=OUT/name
 if not dest.exists():os.link(path,dest)
 return {'key':'map-models/'+name,'sha256':sha,'size':path.stat().st_size,'mimeType':mime,'fileName':path.name}

def simplify(points,tolerance=.016):
 if len(points)<=2:return points
 a,b=np.asarray(points[0]),np.asarray(points[-1]);ab=b-a;den=np.dot(ab,ab)
 distances=[np.linalg.norm(np.asarray(p)-a) if not den else np.linalg.norm(np.asarray(p)-(a+np.clip(np.dot(np.asarray(p)-a,ab)/den,0,1)*ab)) for p in points]
 index=int(np.argmax(distances))
 if distances[index]<=tolerance:return [points[0],points[-1]]
 return simplify(points[:index+1],tolerance)[:-1]+simplify(points[index:],tolerance)

def contours(row):
 path=MODELS/row['sourcePath'];count=row['triangles']
 vertices=np.memmap(path,dtype=np.dtype([('n','<f4',(3,)),('v','<f4',(3,3)),('a','<u2')]),mode='r',offset=84,shape=(count,))['v']
 plane=row['cutHeight']+row['surfaceHeight']*35+3.5
 z=vertices[:,:,2];triangles=vertices[(z.min(1)<plane)&(z.max(1)>plane)]
 graph={};positions={}
 for triangle in triangles:
  points=[]
  for i,j in [(0,1),(1,2),(2,0)]:
   a,b=triangle[i],triangle[j]
   if (a[2]<plane)!=(b[2]<plane):
    p=a+(b-a)*((plane-a[2])/(b[2]-a[2]));key=tuple(np.round(p[:2],3));points.append(key)
    cx=(row['min'][0]+row['max'][0])/2;cy=(row['min'][1]+row['max'][1])/2
    offset=row['placementOffset']
    positions[key]=[round(float(np.clip(row['width']/2+(p[0]-cx)/35+offset[0],0,row['width'])),4),round(float(np.clip(row['height']/2-(p[1]-cy)/35+offset[1],0,row['height'])),4)]
  if len(points)==2 and points[0]!=points[1]:
   a,b=points;graph.setdefault(a,set()).add(b);graph.setdefault(b,set()).add(a)
 result=[]
 while graph:
  start=next(iter(graph));current=start;previous=None;points=[]
  for _ in range(30000):
   points.append(positions[current]);nexts=graph.get(current,set())-({previous} if previous else set())
   if not nexts:break
   nxt=next(iter(nexts));graph.get(current,set()).discard(nxt);graph.get(nxt,set()).discard(current)
   if not graph.get(current):graph.pop(current,None)
   previous,current=current,nxt
   if current==start:break
  graph.pop(current,None)
  if current==start and len(points)>=3:
   points=simplify(points+[points[0]])[:-1]
   if len(points)>=3:result.append(points[:500])
 return sorted(result,key=lambda p:abs(sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p)))),reverse=True)[:100]

def contains(polygon,x,y):
 inside=False
 for i,(ax,ay) in enumerate(polygon):
  bx,by=polygon[i-1]
  if (ay>y)!=(by>y) and x<(bx-ax)*(y-ay)/(by-ay)+ax:inside=not inside
 return inside

def walls(row,polygons):
 if row['tileType'] not in ['wall','floor']:return 'none',0,'none'
 center=any(contains(p,row['width']/2,row['height']/2) for p in polygons)
 mode='center' if row['collection']=='lost-cave' and 'Flat' not in row['sourceName'] else 'edge'
 if row['tileType']=='wall' and center:mode='center'
 mask=0
 if row['tileType']=='wall':
  directions=[(0,-1),(1,-1),(1,0),(1,1),(0,1),(-1,1),(-1,0),(-1,-1)]
  for index,(dx,dy) in enumerate(directions):
   if mode=='edge' and index%2:continue
   if any(contains(p,row['width']/2+dx*(row['width']/2-.015),row['height']/2+dy*(row['height']/2-.015)) for p in polygons):mask|=1<<index
 layout={0:'none',1:'corner',17:'straight',65:'angle',21:'tee',85:'cross'}.get(mask,'custom')
 if row['tileType']=='wall' and mode=='edge':layout='angle' if mask.bit_count()==2 else 'straight' if mask.bit_count()==1 else 'custom'
 return mode,mask,layout

placements={(r['collection'],r['code'],r['sourceName']):r for r in json.loads((MODELS/'collections/manifest.json').read_text())}
rows=json.loads((ROOT/'internal/battlemap/catalogue.json').read_text());old={m['sourceCode'] for m in rows}
for report in sorted(BASE.glob('*/*/report.json')):
 row=json.loads(report.read_text())
 placement=placements[(row['collection'],row['code'],row['sourceName'])]
 row.update({key:placement[key] for key in ['width','height','placementOffset']})
 if row['code'] in old:continue
 directory=report.parent
 image=Image.open(directory/'preview.png').convert('RGB');image.thumbnail((256,256));image.save(directory/'preview.webp','WEBP',quality=85)
 files={'render':asset(directory/'render.glb','model/gltf-binary','glb'),'lod':asset(directory/'lod.glb','model/gltf-binary','glb'),
        'preview':asset(directory/'preview.webp','image/webp','webp'),'source':asset(MODELS/row['sourcePath'],'model/stl','stl')}
 blockers=contours(row);mode,mask,layout=walls(row,blockers)
 tags=[tag for tag in ['wood','skull','bone','pipe','stalagmite','water','railway','mushroom','crystal'] if tag in row['sourceName'].lower()]
 m={'id':str(uuid.uuid5(uuid.NAMESPACE_URL,'dndshare:'+row['collection']+':'+row['code']+':'+files['render']['sha256'])),
    'collection':row['collection'],'collectionName':row['collectionName'],'sourceCode':row['code'],'sourceName':row['sourceName'],'name':row['sourceName'],'version':row.get('variantVersion',1),
    'tileType':tile_category(row['tileType'],row['sourceName'],mode,mask,layout),'wallMode':mode,'wallMask':mask,'width':row['width'],'height':row['height'],
    'surfaceHeight':row['surfaceHeight'],'maxHeight':row['maxHeight'],'blockers':blockers,'tags':tags,'supportSlots':row['supportSlots'],'assets':files}
 m['hasDecor']=row['tileType']=='prop' or bool(tags)
 m['canStand']=False;m['placementPoints']=[]
 m['hidden']=row['collection']=='ultimate-dungeon' and row['code'] in ['UD-104','UD-108','UD-092']
 m['mountDepth']=placement['mountDepth']
 m['placementOffset']=placement['placementOffset']
 rows.append(m);print('CATALOGUED',m['sourceCode'],m['wallMode'],m['wallMask'],len(m['supportSlots']),flush=True)
# Existing assets are linked into the upload workspace, but are not retransferred if already registered.
for model in rows[:15]:
 for info in model['assets'].values():
  src=MODELS/'prepared/upload'/Path(info['key']).name;dst=OUT/src.name
  if not dst.exists():os.link(src,dst)
(OUT/'catalogue.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
(OUT/'summary.json').write_text(json.dumps({'models':len(rows),'bytes':sum(m['assets']['render']['size'] for m in rows),'collections':{c:sum(m['collection']==c for m in rows) for c in sorted({m['collection'] for m in rows})}},indent=2)+'\n')
print('COMPLETE',len(rows),flush=True)
