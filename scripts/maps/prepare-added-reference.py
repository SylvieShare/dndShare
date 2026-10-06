"""Sample distance to an author-supplied bare counterpart in cropped STL mm."""
import argparse
import json
import numpy as np
from pathlib import Path
from mathutils.bvhtree import BVHTree
import sys
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--bare',required=True)
parser.add_argument('--target',required=True)
parser.add_argument('--wall')
parser.add_argument('--bare-max-z',type=float)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
rows=json.loads((ROOT/'models/collections/manifest.json').read_text())
bare=next(r for r in rows if r['collection']=='ultimate-dungeon' and r['code']==args.bare)
target=next(r for r in rows if r['collection']=='ultimate-dungeon' and r['code']==args.target)
dtype=np.dtype([('normal','<f4',(3,)),('v','<f4',(3,3)),('a','<u2')])
def source_triangles(row):
    data=np.memmap(ROOT/'models'/row['sourcePath'],dtype=dtype,mode='r',offset=84,shape=(row['triangles'],))['v'].copy()
    data[:,:,2]-=row['cutHeight']
    return data
triangles=source_triangles(bare)
if args.bare_max_z is not None:
    triangles=triangles[triangles[:,:,2].max(1)<=args.bare_max_z]
wall=None
if args.wall:
    wall=next(r for r in rows if r['collection']=='ultimate-dungeon' and r['code']==args.wall)
    triangles=np.concatenate([triangles,source_triangles(wall)])
vertices,indices=np.unique(triangles.reshape(-1,3),axis=0,return_inverse=True)
tree=BVHTree.FromPolygons(vertices.tolist(),indices.reshape(-1,3).tolist(),all_triangles=True)
step=.25;low=[-17.75,-17.75,13];high=[17.75,17.75,target['max'][2]-target['cutHeight']+.5]
size=[int(np.ceil((b-a)/step))+1 for a,b in zip(low,high)]
samples=np.empty((size[2],size[1],size[0]),np.uint8)
for iz in range(size[2]):
    for iy in range(size[1]):
        for ix in range(size[0]):
            p=(low[0]+ix*step,low[1]+iy*step,low[2]+iz*step)
            samples[iz,iy,ix]=min(255,round(tree.find_nearest(p)[3]*255))
    if iz%25==0:print('REFERENCE_SLICE',iz,size[2],flush=True)
out=ROOT/'models/collections/added-reference'/args.target
out.mkdir(parents=True,exist_ok=True)
(out/'distance.bin').write_bytes(samples.tobytes())
reference={'low':low,'step':step,'size':size,'scale':255,'bare':args.bare,'sourceSHA256':bare['sourceSHA256']}
if args.bare_max_z is not None:
    reference['bareMaxZ']=args.bare_max_z
if wall:
    reference.update(wall=args.wall,wallSourceSHA256=wall['sourceSHA256'])
(out/'reference.json').write_text(json.dumps(reference,indent=2)+'\n')
print('ADDED_REFERENCE',args.target,args.bare,size,flush=True)
