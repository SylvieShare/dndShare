"""Read cropped STL coordinates underneath pixels in an orthographic top preview."""
import argparse
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import barycentric_transform
parser=argparse.ArgumentParser()
parser.add_argument('--report',type=Path,required=True)
parser.add_argument('--size',type=int,default=1024)
parser.add_argument('--points',nargs='+',default=[])
parser.add_argument('--project',nargs='+',default=[])
parser.add_argument('--view',choices=['top','inside','front','reverse'],default='top')
parser.add_argument('--normals',action='store_true')
parser.add_argument('--albedo',action='store_true')
parser.add_argument('--focus-max-z',type=float)
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
if args.focus_max_z is not None:high.z=min(high.z,args.focus_max_z/35-model['mountDepth'])
centre=(low+high)/2;scale=max(*(high-low),1)*1.5
directions={'top':(0,-.01,5),'inside':(-2,-2.85,2.45),'front':(-2,2.85,2.45),'reverse':(2,-2.85,2.45)}
camera=centre+Vector(directions[args.view]);rotation=(centre-camera).to_track_quat('-Z','Y')
for text in args.project:
    x,y,z=map(float,text.split(','))
    world=Vector((x/35+model['placementOffset'][0],y/35-model['placementOffset'][1],z/35-model['mountDepth']))
    local=rotation.inverted()@(world-camera)
    print('PROJECTED_POINT',text,[round((local.x/scale+.5)*args.size,2),round((.5-local.y/scale)*args.size,2)],flush=True)
graph=bpy.context.evaluated_depsgraph_get()
for text in args.points:
    x,y=map(float,text.split(','))
    origin=camera+rotation@Vector(((x/args.size-.5)*scale,(.5-y/args.size)*scale,0))
    hit=bpy.context.scene.ray_cast(graph,origin,rotation@Vector((0,0,-1)))
    if hit[0]:
        p=hit[1];stl=[(p.x-model['placementOffset'][0])*35,(p.y+model['placementOffset'][1])*35,(p.z+model['mountDepth'])*35]
        print('SURFACE_POINT',text,[round(v,4) for v in stl],flush=True)
        if args.normals:print('SURFACE_NORMAL',text,[round(v,4) for v in hit[2]],flush=True)
        if args.albedo:
            obj=hit[4];face=obj.data.polygons[hit[3]];uvs=obj.data.uv_layers.active.data
            local=obj.matrix_world.inverted()@hit[1]
            uv=barycentric_transform(local,*(obj.data.vertices[v].co for v in face.vertices),*(Vector((*uvs[l].uv,0)) for l in face.loop_indices))
            mat=obj.data.materials[face.material_index]
            for node in mat.node_tree.nodes:
                if node.type=='TEX_IMAGE' and node.image:
                    picture=node.image;w,h=picture.size
                    ix=max(0,min(w-1,int(uv.x*w)));iy=max(0,min(h-1,int(uv.y*h)))
                    offset=(iy*w+ix)*4
                    print('SURFACE_TEXTURE',text,node.label,[round(picture.pixels[offset+i]*255,2) for i in range(4)],flush=True)
    else:print('SURFACE_MISSING',text,flush=True)
