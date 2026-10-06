"""Distance to the bare corner masonry, only around bone/wall intersections."""
import bpy
import json
import numpy as np
from pathlib import Path
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2]
row=next(r for r in json.loads((ROOT/'models/collections/manifest.json').read_text()) if r['code']=='UD-014')
dtype=np.dtype([('normal','<f4',(3,)),('v','<f4',(3,3)),('a','<u2')])
triangles=np.memmap(ROOT/'models'/row['sourcePath'],dtype=dtype,mode='r',offset=84,shape=(row['triangles'],))['v'].copy()
triangles[:,:,2]-=row['cutHeight']
vertices,indices=np.unique(triangles.reshape(-1,3),axis=0,return_inverse=True)
tree=BVHTree.FromPolygons(vertices.tolist(),indices.reshape(-1,3).tolist(),all_triangles=True)
out=ROOT/'models/collections/ud013-wall-reference'
out.mkdir(exist_ok=True)
spec={'step':.2,'near':9.8,'far':13.4,'min':-17.6,'zMin':13.4,'zMax':38.8,'distanceScale':255,'sourceSHA256':row['sourceSHA256']}
ns=round((spec['far']-spec['near'])/spec['step'])+1
nt=round((spec['far']-spec['min'])/spec['step'])+1
nz=round((spec['zMax']-spec['zMin'])/spec['step'])+1
spec.update(slabSize=ns,spanSize=nt,zSize=nz)
for axis in ['x','y']:
    samples=np.empty((nz,nt,ns),np.uint8)
    for iz in range(nz):
        z=spec['zMin']+iz*spec['step']
        for it in range(nt):
            t=spec['min']+it*spec['step']
            for i in range(ns):
                s=spec['near']+i*spec['step']
                point=(s,t,z) if axis=='x' else (t,s,z)
                distance=tree.find_nearest(point)[3]
                samples[iz,it,i]=min(255,round(distance*255))
    (out/(axis+'.bin')).write_bytes(samples.tobytes())
    print('WALL_REFERENCE',axis,samples.shape,flush=True)
(out/'reference.json').write_text(json.dumps(spec,indent=2)+'\n')
