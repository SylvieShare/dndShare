"""Read cropped STL coordinates underneath pixels in an orthographic top preview."""
import argparse
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector
parser=argparse.ArgumentParser()
parser.add_argument('--report',type=Path,required=True)
parser.add_argument('--size',type=int,default=1024)
parser.add_argument('--points',nargs='+',required=True)
parser.add_argument('--view',choices=['top','inside','front','reverse'],default='top')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
model=json.loads(args.report.read_text())['model']
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(args.report.parent/'preview-model.glb'))
for obj in bpy.context.scene.objects:
    if obj.parent is None:
        obj.location.x+=model['placementOffset'][0]
        obj.location.y-=model['placementOffset'][1]
        obj.location.z-=model['mountDepth']
bpy.context.view_layer.update()
bounds=[obj.matrix_world@Vector(c) for obj in bpy.context.scene.objects if obj.type=='MESH' for c in obj.bound_box]
low=Vector(tuple(min(p[a] for p in bounds) for a in range(3)))
high=Vector(tuple(max(p[a] for p in bounds) for a in range(3)))
centre=(low+high)/2;scale=max(*(high-low),1)*1.5
directions={'top':(0,-.01,5),'inside':(-2,-2.85,2.45),'front':(-2,2.85,2.45),'reverse':(2,-2.85,2.45)}
camera=centre+Vector(directions[args.view]);rotation=(centre-camera).to_track_quat('-Z','Y')
graph=bpy.context.evaluated_depsgraph_get()
for text in args.points:
    x,y=map(float,text.split(','))
    origin=camera+rotation@Vector(((x/args.size-.5)*scale,(.5-y/args.size)*scale,0))
    hit=bpy.context.scene.ray_cast(graph,origin,rotation@Vector((0,0,-1)))
    if hit[0]:
        p=hit[1];stl=[(p.x-model['placementOffset'][0])*35,(p.y+model['placementOffset'][1])*35,(p.z+model['mountDepth'])*35]
        print('SURFACE_POINT',text,[round(v,4) for v in stl],flush=True)
    else:print('SURFACE_MISSING',text,flush=True)
