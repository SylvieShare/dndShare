"""Distance field of an original undecorated wall or ground for decorated wall masks."""
import bpy, json, hashlib, sys, argparse
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).resolve().parent))
from tile_mesh import crop
root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--code',choices=[f'LC-{i:03}' for i in range(1,10)]+['LC-066','LC-074'],default='LC-001')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
row=next(r for r in json.loads((root/'models/collections/manifest.json').read_text())
         if r['collection']=='lost-cave' and r['code']==args.code)
source=root/'models'/row['sourcePath']
assert hashlib.sha256(source.read_bytes()).hexdigest()==row['sourceSHA256']
out=root/'models/collections/lost-cave/wall-reference'/args.code;out.mkdir(parents=True,exist_ok=True)
low=[-18,-18,-1];step=.25;size=[145,145,165];scale=4096
spec={'low':low,'step':step,'size':size,'scale':scale,'sourceCode':row['code'],
      'sourceSHA256':row['sourceSHA256'],'cutHeight':row['cutHeight']}
meta=out/'reference.json';data=out/'distance.bin'
if meta.exists() and data.exists():
    old=json.loads(meta.read_text())
    if all(old.get(k)==v for k,v in spec.items()) and data.stat().st_size==np.prod(size)*2 and hashlib.sha256(data.read_bytes()).hexdigest()==old.get('fieldSHA256'):
        print('WALL_REFERENCE_REUSED',data.stat().st_size,flush=True);sys.exit(0)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.wm.stl_import(filepath=str(source));obj=bpy.context.object
crop(obj,row['cutHeight']);bpy.context.view_layer.update()
assert all(low[i]<=v.co[i]<=low[i]+step*(size[i]-1) for v in obj.data.vertices for i in range(3)), 'Reference grid does not cover the complete wall'
tree=BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get())
samples=np.empty((size[2],size[1],size[0]),dtype='<u2')
for iz in range(size[2]):
    for iy in range(size[1]):
        for ix in range(size[0]):
            p=Vector((low[0]+ix*step,low[1]+iy*step,low[2]+iz*step))
            samples[iz,iy,ix]=min(65535,round(tree.find_nearest(p)[3]*scale))
    if iz%30==0:print('WALL_REFERENCE_SLICE',iz,size[2],flush=True)
payload=samples.tobytes();data.write_bytes(payload);spec['fieldSHA256']=hashlib.sha256(payload).hexdigest()
meta.write_text(json.dumps(spec,indent=2)+'\n');print('WALL_REFERENCE_READY',len(payload),flush=True)
