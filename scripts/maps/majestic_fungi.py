"""Measured fungal groups: golden cap rims, darker bowls, ribs and stems."""
import json
from pathlib import Path
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree


def apply_fungi(obj, positions, colours, roughness, recipe):
    root=Path(__file__).resolve().parents[2];rows=json.loads((root/'models/collections/majestic-highlands/manifest.json').read_text())
    settings=recipe['fungiReference'];row=next(r for r in rows if r['code']==settings['code'])
    bpy.ops.wm.stl_import(filepath=str(root/'models'/row['sourcePath']));reference=bpy.context.object
    angle=np.deg2rad(settings.get('rotateZ',0));c,s=np.cos(angle),np.sin(angle)
    for v in reference.data.vertices:
        x,y=v.co.x,v.co.y;v.co.x,v.co.y=x*c-y*s,x*s+y*c
    reference.data.update();tree=BVHTree.FromObject(reference,bpy.context.evaluated_depsgraph_get())
    distances=np.array([tree.find_nearest(v.co)[3] for v in obj.data.vertices],np.float32)
    bpy.data.objects.remove(reference,do_unlink=True)
    weight=np.clip((distances-settings['matchMM'])/settings['blendMM'],0,1);weight=weight*weight*(3-2*weight)
    weight*=positions[:,2]>15.1
    x,y,z=positions.T;normals=np.array([tuple(v.normal) for v in obj.data.vertices])
    variation=1+.045*np.sin(x*.39+y*.21+z*.13)+.025*np.sin(x*1.3-y*.8)
    surface=np.array([.61,.435,.19])*variation[:,None]
    base_rough=np.full(len(z),.92)
    for cap in recipe['fungiCaps']:
        centre=np.array(cap['centreMM']);axis=np.array(cap['axis'],dtype=float);axis/=np.linalg.norm(axis)
        delta=positions-centre;along=delta@axis;plane=delta-along[:,None]*axis
        radial=np.linalg.norm(plane,axis=1);ratio=radial/cap['radiusMM']
        domain=(radial<cap['radiusMM']+1)&(np.abs(along)<cap['halfDepthMM'])
        if cap.get('paintInterior'):
            interior=domain&(radial<cap['radiusMM']*.48)&(z>cap.get('interiorMinZMM',14))
            weight=np.maximum(weight,interior.astype(np.float32))
        u=np.cross(axis,[0,1,0]);u/=np.linalg.norm(u);v=np.cross(axis,u);theta=np.arctan2(plane@v,plane@u)
        rim=np.clip((ratio-.25)/.6,0,1);rim=rim*rim*(3-2*rim)
        inside=normals@axis>.1
        ribs=1+.055*np.sin(theta*24+radial*.18)+.025*np.sin(radial*1.7)
        light=np.array(cap.get('rimRGB',[.79,.60,.22]));dark=np.array(cap.get('centreRGB',[.43,.26,.085]))
        top=(dark*(1-rim[:,None])+light*rim[:,None])*ribs[:,None]
        underside=np.array([.62,.405,.13])*(.95+.075*np.sin(theta*24))[:,None]
        rgb=np.where(inside[:,None],top,underside)
        surface[domain]=rgb[domain];base_rough[domain]=.90
    colours=colours*(1-weight[:,None])+surface*weight[:,None]
    roughness=roughness*(1-weight)+base_rough*weight
    print('FUNGI_REFERENCE',np.quantile(distances,[.1,.5,.9,1]).tolist(),float(weight.mean()),flush=True)
    return colours,roughness
