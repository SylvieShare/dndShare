"""Distance to the complete upright author wagon, in unscaled local millimetres."""
import bpy,json,sys,hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[2]
row=next(r for r in json.loads((root/'models/collections/manifest.json').read_text())
         if r['collection']=='lost-cave' and r['code']=='LC-027')
source=root/'models'/row['sourcePath']
assert hashlib.sha256(source.read_bytes()).hexdigest()==row['sourceSHA256']
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.stl_import(filepath=str(source));obj=bpy.context.object
for v in obj.data.vertices:
    v.co.y=-v.co.y;v.co.z=row['max'][2]-v.co.z
obj.data.update();bpy.context.view_layer.update()
tree=BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get())
low=[-18,-18,-1];step=.25;size=[145,145,153]
samples=np.empty((size[2],size[1],size[0]),np.uint8)
for iz in range(size[2]):
    for iy in range(size[1]):
        for ix in range(size[0]):
            p=Vector((low[0]+ix*step,low[1]+iy*step,low[2]+iz*step))
            samples[iz,iy,ix]=min(255,round(tree.find_nearest(p)[3]*255))
    if iz%30==0:print('WAGON_REFERENCE_SLICE',iz,size[2],flush=True)
out=root/'models/collections/lost-cave/wagon-reference';out.mkdir(parents=True,exist_ok=True)
(out/'distance.bin').write_bytes(samples.tobytes())
(out/'reference.json').write_text(json.dumps({'low':low,'step':step,'size':size,'scale':255,
    'sourceCode':'LC-027','sourceSHA256':row['sourceSHA256'],'rotationXDeg':180},indent=2)+'\n')
print('WAGON_REFERENCE_READY',len(samples.tobytes()),flush=True)
