"""Paint measured sculpted water without recolouring banks or overhanging arches."""
import json
from pathlib import Path
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree


def apply_water(obj, positions, colours, roughness, recipe):
    root=Path(__file__).resolve().parents[2]
    settings=recipe['water']
    rows=json.loads((root/'models/collections/majestic-highlands/manifest.json').read_text())
    row=next(r for r in rows if r['code']==settings['reference'])
    bpy.ops.wm.stl_import(filepath=str(root/'models'/row['sourcePath']))
    reference=bpy.context.object
    angle=np.deg2rad(settings.get('rotateZ',0));c,s=np.cos(angle),np.sin(angle)
    shift=np.array(settings.get('translationMM',[0,0,0]))
    for v in reference.data.vertices:
        x,y=v.co.x,v.co.y
        v.co.x=x*c-y*s+float(shift[0]);v.co.y=x*s+y*c+float(shift[1]);v.co.z+=float(shift[2])
    reference.data.update()
    tree=BVHTree.FromObject(reference,bpy.context.evaluated_depsgraph_get())
    distances=np.array([tree.find_nearest(v.co)[3] for v in obj.data.vertices],np.float32)
    bpy.data.objects.remove(reference,do_unlink=True)
    weight=1-np.clip((distances-settings.get('matchMM',.06))/settings.get('blendMM',.16),0,1)
    weight=weight*weight*(3-2*weight)
    x,y,z=positions.T
    normals=np.empty(len(positions)*3,np.float32)
    obj.data.vertices.foreach_get('normal',normals);normals=normals.reshape(-1,3)
    if settings.get('restoreLowWaterAroundStonesMM'):
        for stone in settings.get('stones',[]):
            radius=np.linalg.norm((positions[:,:2]-np.array(stone['centreMM'][:2]))/np.array(stone['radiiMM'][:2]),axis=1)
            near=np.clip((1.7-radius)/.25,0,1)
            low=np.clip((settings['restoreLowWaterAroundStonesMM']-z)/.2,0,1)
            weight=np.maximum(weight,near*low)
    weight*=np.clip((z-settings['minZMM'])/.35,0,1)*np.clip((normals[:,2]-.05)/.2,0,1)
    if settings.get('boundsMM'):
        lo,hi=np.array(settings['boundsMM'][0]),np.array(settings['boundsMM'][1])
        weight*=np.all((positions>=lo)&(positions<=hi),axis=1)
    height=np.clip((z-settings['lowZMM'])/(settings['highZMM']-settings['lowZMM']),0,1)
    low=np.array(settings['deepRGB']);high=np.array(settings['shallowRGB'])
    water=low*(1-height[:,None])+high*height[:,None]
    crest=np.clip((height-.65)/.35,0,1)*np.clip((normals[:,2]-.55)/.35,0,1)*.55
    water=water*(1-crest[:,None])+np.array(settings['crestRGB'])*crest[:,None]
    water*=1+.025*np.sin(x*.29+y*.13)[:,None]
    colours=colours*(1-weight[:,None])+water*weight[:,None]
    roughness=roughness*(1-weight)+settings.get('roughness',.28)*weight
    for stone in settings.get('stones',[]):
        radius=np.linalg.norm((positions-np.array(stone['centreMM']))/np.array(stone['radiiMM']),axis=1)
        stone_weight=np.clip((1-radius)/.12,0,1)*np.clip((z-stone['minZMM'])/.45,0,1)*(1-weight)
        shade=1+.04*np.sin(x*.63+y*.47+z*.31)
        colours=colours*(1-stone_weight[:,None])+np.array(stone['rgb'])*shade[:,None]*stone_weight[:,None]
        roughness=roughness*(1-stone_weight)+.82*stone_weight
    for bank in settings.get('banks',[]):
        radius=np.linalg.norm((positions[:,:2]-np.array(bank['centreMM']))/np.array(bank['radiiMM']),axis=1)
        bank_weight=np.clip((radius-bank['innerRadius'])/.12,0,1)*np.clip((bank['outerRadius']-radius)/.12,0,1)
        bank_weight*=np.clip((z-bank['minZMM'])/.4,0,1)*(1-weight)
        shade=1+.045*np.sin(x*.51+y*.43+z*.21)
        colours=colours*(1-bank_weight[:,None])+np.array(bank['rgb'])*shade[:,None]*bank_weight[:,None]
        roughness=roughness*(1-bank_weight)+.88*bank_weight
    print('WATER_REFERENCE',np.quantile(distances,[0,.25,.5,.75,.9,1]).tolist(),int((weight>.5).sum()),flush=True)
    return colours,roughness
