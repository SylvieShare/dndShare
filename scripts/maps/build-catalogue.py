"""Build metadata and an upload folder from prepared, ignored model assets.

Run after prepare-assets.mjs and models/_tools/catalogue_previews.py.
Only metadata is tracked. The upload folder contains content-addressed files.
"""
from pathlib import Path
import hashlib, json, os, struct, uuid
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT/'models'
RUNTIME = MODELS/'prepared/runtime'
UPLOAD = MODELS/'prepared/upload'
UPLOAD.mkdir(parents=True,exist_ok=True)
NAMES = ['Стена 1','Стена 2','Угол стены','Т-образная стена','Х-образная стена',
         'Угловой выступ','Пол 1','Пол 2','Пол 3','Сталагмиты 1','Сталагмиты 2',
         'Стена со сталагмитами 1','Стена со сталагмитами 2','Угол со сталагмитами','Выступ со сталагмитами']
WALLS = ['straight','straight','angle','tee','cross','corner','none','none','none',
         'none','none','straight','straight','angle','corner']

def sha(path):
    with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()

def asset(path,mime,extension):
    checksum=sha(path)
    name=checksum+'.'+extension
    dest=UPLOAD/name
    if not dest.exists():os.link(path,dest)
    return {'key':'map-models/'+name,'sha256':checksum,'size':path.stat().st_size,
            'mimeType':mime,'fileName':path.name}

def simplify(points,tolerance=.012):
    if len(points)<=2:return points
    a,b=np.asarray(points[0]),np.asarray(points[-1])
    ab=b-a;den=np.dot(ab,ab)
    distance=[np.linalg.norm(np.asarray(p)-a) if den==0 else
              np.linalg.norm(np.asarray(p)-(a+np.clip(np.dot(np.asarray(p)-a,ab)/den,0,1)*ab)) for p in points]
    index=int(np.argmax(distance))
    if distance[index]<=tolerance:return [points[0],points[-1]]
    return simplify(points[:index+1],tolerance)[:-1]+simplify(points[index:],tolerance)

def blockers(path,cut):
    count=struct.unpack('<I',path.read_bytes()[80:84])[0]
    dtype=np.dtype([('normal','<f4',(3,)),('vertices','<f4',(3,3)),('attr','<u2')])
    vertices=np.memmap(path,dtype=dtype,mode='r',offset=84,shape=(count,))['vertices']
    plane=cut+14.74+3.5
    z=vertices[:,:,2]
    vertices=vertices[(z.min(1)<plane)&(z.max(1)>plane)]
    graph={};positions={}
    for triangle in vertices:
        points=[]
        for i,j in [(0,1),(1,2),(2,0)]:
            a,b=triangle[i],triangle[j]
            if (a[2]<plane)!=(b[2]<plane):
                p=a+(b-a)*((plane-a[2])/(b[2]-a[2]))
                key=tuple(np.round(p[:2],3))
                points.append(key);positions[key]=[round(float(.5+p[0]/35),4),round(float(.5-p[1]/35),4)]
        if len(points)==2 and points[0]!=points[1]:
            a,b=points
            graph.setdefault(a,set()).add(b);graph.setdefault(b,set()).add(a)
    polygons=[]
    while graph:
        start=next(iter(graph));current=start;previous=None;points=[]
        for _ in range(20000):
            points.append(positions[current])
            neighbours=graph.get(current,set())-({previous} if previous else set())
            if not neighbours:break
            nxt=next(iter(neighbours))
            graph.get(current,set()).discard(nxt);graph.get(nxt,set()).discard(current)
            if not graph.get(current):graph.pop(current,None)
            previous,current=current,nxt
            if current==start:break
        graph.pop(current,None)
        if current==start and len(points)>3:
            points=simplify(points+[points[0]])[:-1]
            if len(points)>=3:polygons.append(points)
    return polygons

rows=json.loads((MODELS/'prepared/report.json').read_text())
mounts={r['code']:r['mountDepth'] for r in json.loads((MODELS/'collections/manifest.json').read_text()) if r['collection']=='lost-cave'}
catalogue=[]
for row in rows:
    code=row['code'];index=int(code[-3:])-1
    image=Image.open(RUNTIME/(code+'.png')).convert('RGB')
    image.thumbnail((256,256))
    preview=RUNTIME/(code+'.webp');image.save(preview,'WEBP',quality=85)
    files={
        'render':asset(RUNTIME/(code+'.render.glb'),'model/gltf-binary','glb'),
        'lod':asset(RUNTIME/(code+'.lod.glb'),'model/gltf-binary','glb'),
        'preview':asset(preview,'image/webp','webp'),
        'source':asset(MODELS/'lost-cave/originals'/row['sourceFile'],'model/stl','stl'),
    }
    model={'id':str(uuid.uuid5(uuid.NAMESPACE_URL,'dndshare:lost-cave:'+code+':'+files['render']['sha256'])),
           'collection':'lost-cave','sourceCode':code,'sourceName':row['name'],'name':NAMES[index],
           'tileType':'floor' if index in [6,7,8,9,10] else 'wall-'+('end' if WALLS[index]=='corner' else WALLS[index]),
           'width':1,'height':1,
           'surfaceHeight':round(14.74/35,6),'maxHeight':round(row['cropped']['max'][2]/35,6),
           'blockers':blockers(MODELS/'lost-cave/originals'/row['sourceFile'],row['cutHeight']),
           'tags':['rock']+(['stalagmite'] if index>=9 else []),'assets':files}
    model['mountDepth']=mounts[code]
    catalogue.append(model)
    print(code,model['id'],'blockers',len(model['blockers']))
dest=ROOT/'internal/battlemap/catalogue.json'
dest.write_text(json.dumps(catalogue,ensure_ascii=False,indent=2)+'\n')
(UPLOAD/'catalogue.json').write_text(dest.read_text())
