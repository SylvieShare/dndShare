"""Probe both sides of every actual packed window pane, protecting timber."""
import argparse
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('liquid_pixel_helpers',Path(__file__).with_name('validate-medieval-liquids.py'))
helpers = importlib.util.module_from_spec(spec); spec.loader.exec_module(helpers)

def validate(code,candidate):
    directory = ROOT/'models/collections/medieval-town-vol1/review'/code
    if candidate: directory /= 'candidates/'+candidate
    report_path = directory/'report.json'; report = json.loads(report_path.read_text())
    parts = [p for p in report['recipe']['materials'].get('surfaceParts',[]) if p.get('kind')=='glass']
    if not parts: raise ValueError('Measured glass panes required')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.stl_import(filepath=str(ROOT/'models'/report['sourcePath']))
    source = BVHTree.FromObject(bpy.context.object,bpy.context.evaluated_depsgraph_get())
    references = {}
    for part in parts:
        y,z = [(part['minMM'][i]+part['maxMM'][i])/2 for i in [1,2]]
        for side in [-1,1]:
            h = source.ray_cast((side*30,y,z),(-side,0,0))
            if h[0] is None or h[1].x*side<.5: raise ValueError('Invalid source pane probe')
            references[part['name'],side] = (y,z,h[0].x)
    evidence = {}
    for tier,filename in [('render','preview-model.glb'),('lod','lod-preview-model.glb')]:
        if helpers.base_color_images(directory/filename)!=helpers.base_color_images(directory/(tier+'.glb')):
            raise ValueError('Preview albedo differs from actual packed '+tier)
        bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=str(directory/filename))
        meshes = [(o,BVHTree.FromObject(o,bpy.context.evaluated_depsgraph_get())) for o in bpy.context.scene.objects if o.type=='MESH']
        rows = []
        for part in parts:
            for side in [-1,1]:
                y,z,reference = references[part['name'],side]; hits=[]
                for obj,tree in meshes:
                    inv=obj.matrix_world.inverted();hit=tree.ray_cast(inv@Vector((side*30/35,y/35,z/35)),inv.to_3x3()@Vector((-side,0,0)))
                    if hit[0] is not None: hits.append(((obj.matrix_world@hit[0]).x*35,obj,hit))
                if not hits: raise ValueError('Missing pane: '+part['name'])
                x,obj,hit=max(hits,key=lambda row:row[0]*side); normal=obj.matrix_world.to_3x3()@hit[1];normal.normalize()
                polygon=obj.data.polygons[hit[2]];loops=list(polygon.loop_indices)
                if len(loops)!=3: raise ValueError('Triangulated pane required')
                positions=[obj.data.vertices[obj.data.loops[i].vertex_index].co for i in loops]
                coords=[Vector((*obj.data.uv_layers.active.data[i].uv,0)) for i in loops]
                uv=barycentric_transform(hit[0],*positions,*coords)
                shader=next(n for n in obj.data.materials[polygon.material_index].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
                rgb=helpers.sample_image(shader.inputs['Base Color'].links[0].from_node.image,uv)
                ratio=rgb[1]/max(rgb[0],rgb[2],1e-6)
                row=dict(name=part['name'],side=side,positionMM=[x,y,z],referenceXMM=reference,deviationMM=abs(x-reference),normalFacing=normal.x*side,sampledRGB=rgb,greenRatio=ratio)
                print('MEDIEVAL_GLASS_PIXEL',code,tier,json.dumps(row),flush=True)
                if abs(x-reference)>.15 or normal.x*side<.5: raise ValueError('Pane geometry changed')
                if ratio<1.1: raise ValueError('Packing lost green glass pigment')
                rows.append(row)
        evidence[tier]=rows
    report['glassPixelReview']=evidence
    report['glassPixelAssets']={tier:sha256((directory/(tier+'.glb')).read_bytes()).hexdigest() for tier in ['render','lod']}
    report_path.write_text(json.dumps(report,indent=2)+'\n')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--code',required=True);parser.add_argument('--candidate',choices=['compact'])
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);validate(args.code,args.candidate)
