"""Measured bone/terrain separation and aged cortical colour variation."""
import json
from pathlib import Path
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree


def apply_bones(obj,positions,colours,roughness,recipe):
    root=Path(__file__).resolve().parents[2];rows=json.loads((root/'models/collections/majestic-highlands/manifest.json').read_text())
    settings=recipe['boneReference'];row=next(r for r in rows if r['code']==settings['code'])
    bpy.ops.wm.stl_import(filepath=str(root/'models'/row['sourcePath']));reference=bpy.context.object
    angle=np.deg2rad(settings.get('rotateZ',0));c,s=np.cos(angle),np.sin(angle)
    for v in reference.data.vertices:
        x,y=v.co.x,v.co.y;v.co.x,v.co.y=x*c-y*s,x*s+y*c
    reference.data.update();tree=BVHTree.FromObject(reference,bpy.context.evaluated_depsgraph_get())
    distances=np.array([tree.find_nearest(v.co)[3] for v in obj.data.vertices],np.float32)
    bpy.data.objects.remove(reference,do_unlink=True)
    weight=np.clip((distances-settings['matchMM'])/settings['blendMM'],0,1);weight=weight*weight*(3-2*weight)
    weight*=positions[:,2]>recipe.get('boneMinZMM',14.3)
    x,y,z=positions.T
    region_plant=np.zeros(len(z),np.float32)
    for box in recipe.get('bonePlantRegions',[]):
        low,high=np.array(box['minMM']),np.array(box['maxMM'])
        edge=np.minimum(positions-low,high-positions).min(1)
        region_plant=np.maximum(region_plant,np.clip(edge/box.get('featherMM',.6),0,1))
    if recipe.get('boneLowMatchMM') is not None:
        close=np.clip((distances-recipe['boneLowMatchMM'])/recipe['boneLowBlendMM'],0,1)
        plant=(1-close*close*(3-2*close))*np.clip((recipe['bonePlantCeilingMM']-z)/recipe['bonePlantFadeMM'],0,1)*weight
        plant=np.maximum(plant,region_plant*weight)
        keep=np.zeros(len(z),np.float32)
        for segment in recipe.get('boneKeepSegments',[]):
            a,b=np.array(segment['fromMM']),np.array(segment['toMM']);axis=b-a
            t=np.clip(((positions-a)*axis).sum(1)/(axis@axis),0,1)
            distance=np.linalg.norm(positions-a-t[:,None]*axis,axis=1)
            keep=np.maximum(keep,np.clip((segment['radiusMM']-distance)/.4,0,1))
        plant*=1-keep
        patch=(np.sin(x*.13+y*.09)+np.sin(x*.23-y*.11)+2)/4
        green=(1-patch[:,None])*np.array([.275,.37,.13])+patch[:,None]*np.array([.36,.405,.145])
        tip=np.clip((z-14.75)/1.55,0,1)*.7
        green=green*(1-tip[:,None])+np.array([.57,.585,.245])*tip[:,None]
        colours=colours*(1-plant[:,None])+green*plant[:,None]
        weight*=1-plant
    patch=(np.sin(x*.17+y*.11+z*.21)+np.sin(x*.29-y*.19+z*.09)+2)/4
    clean=np.array(recipe.get('boneRGB',[.755,.70,.555]));aged=np.array(recipe.get('boneAgedRGB',[.57,.515,.385]))
    surface=clean*(1-patch[:,None]*.40)+aged*patch[:,None]*.40
    grain=1+.035*np.sin(x*1.15+y*.93+z*.71)+.02*np.sin(x*2.9-y*1.7)
    surface*=grain[:,None]
    colours=colours*(1-weight[:,None])+surface*weight[:,None]
    roughness=roughness*(1-weight)+.95*weight
    attr=obj.data.color_attributes.new('Bone','FLOAT_COLOR','POINT')
    attr.data.foreach_set('color',np.column_stack([weight,weight,weight,np.ones(len(weight))]).astype(np.float32).ravel())
    print('BONE_REFERENCE',np.quantile(distances,[.1,.5,.9,1]).tolist(),float(weight.mean()),flush=True)
    return colours,roughness


def bone_finish(nodes,links,finish,recipe):
    mask=nodes.new('ShaderNodeVertexColor');mask.layer_name='Bone'
    ao=nodes.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=recipe.get('boneDirtDistanceMM',1.2);ao.samples=16
    remap=nodes.new('ShaderNodeMath');remap.operation='MULTIPLY_ADD';remap.inputs[1].default_value=.48;remap.inputs[2].default_value=.52
    links.new(ao.outputs['AO'],remap.inputs[0])
    colour=nodes.new('ShaderNodeMixRGB');colour.blend_type='MULTIPLY'
    links.new(mask.outputs['Color'],colour.inputs[0]);links.new(finish.outputs[0],colour.inputs[1]);links.new(remap.outputs[0],colour.inputs[2])
    return colour
