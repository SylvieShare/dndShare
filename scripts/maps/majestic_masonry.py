"""Separate newly added masonry from a measured, transformed terrain reference."""
import json
from pathlib import Path
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree


def apply_masonry(obj, positions, colours, roughness, recipe):
    root=Path(__file__).resolve().parents[2]
    rows=json.loads((root/'models/collections/majestic-highlands/manifest.json').read_text())
    settings=recipe['masonryReference']
    row=next(r for r in rows if r['code']==settings['code'])
    bpy.ops.wm.stl_import(filepath=str(root/'models'/row['sourcePath']))
    reference=bpy.context.object
    angle=np.deg2rad(settings['rotateZ']); c,s=np.cos(angle),np.sin(angle)
    for v in reference.data.vertices:
        x,y=v.co.x,v.co.y;v.co.x,v.co.y=x*c-y*s,x*s+y*c
    shift=np.array(settings.get('translationMM',[0,0,0]))
    for v in reference.data.vertices:
        v.co.x+=float(shift[0]);v.co.y+=float(shift[1]);v.co.z+=float(shift[2])
    reference.data.update()
    tree=BVHTree.FromObject(reference,bpy.context.evaluated_depsgraph_get())
    distances=np.array([tree.find_nearest(v.co)[3] for v in obj.data.vertices],np.float32)
    bpy.data.objects.remove(reference,do_unlink=True)
    weight=np.clip((distances-settings['matchMM'])/settings['blendMM'],0,1)
    weight=weight*weight*(3-2*weight)
    x,y,z=positions.T;u=(x-y)/2**.5;v=(x+y)/2**.5
    bounds=recipe.get('masonryRegion',{'u':[-62,53],'v':[-34,46],'minZMM':15.1})
    region=(u>bounds['u'][0])&(u<bounds['u'][1])&(v>bounds['v'][0])&(v<bounds['v'][1])&(z>bounds['minZMM'])
    weight*=region
    for box in recipe.get('masonryOverrides',[]):
        mask=(u>=box['u'][0])&(u<=box['u'][1])&(v>=box['v'][0])&(v<=box['v'][1])&(z>=box['z'][0])&(z<=box['z'][1])
        weight=np.maximum(weight,mask.astype(np.float32))
    normals=np.empty(len(obj.data.vertices)*3,np.float32)
    obj.data.vertices.foreach_get('normal',normals); normals=normals.reshape(-1,3)
    for box in recipe.get('masonryBoxes',[]):
        mask=(x>=box['x'][0])&(x<=box['x'][1])&(y>=box['y'][0])&(y<=box['y'][1])&(z>=box['z'][0])&(z<=box['z'][1])&(distances>box.get('referenceDeltaMM',.03))&(normals[:,2]>.55)
        weight=np.maximum(weight,mask.astype(np.float32))
    grain=1+recipe.get('stoneVariation',.035)*np.sin(x*.17+y*.13+z*.07)+.018*np.sin(x*1.83-y*1.41+z*.67)
    colour=np.array(recipe.get('masonryRGB',[.47,.445,.37]))*grain[:,None]
    if recipe.get('masonryTopRGB'):
        top=np.clip((normals[:,2]-.4)/.35,0,1)*np.clip((z-recipe['masonryTopMinZMM'])/2,0,1)
        colour=colour*(1-top[:,None])+np.array(recipe['masonryTopRGB'])*grain[:,None]*top[:,None]
    interiors=recipe.get('masonryInteriors',[])
    if recipe.get('masonryInterior'): interiors=[recipe['masonryInterior'],*interiors]
    for interior in interiors:
        radial=positions[:,:2]-np.array(interior['centreMM'])
        distance=np.linalg.norm(radial,axis=1)
        inward=-radial/np.maximum(distance[:,None],1e-6)
        facing=(normals[:,:2]*inward).sum(1)
        inner=np.clip((facing-.2)/.45,0,1)*np.clip((z-interior['minZMM'])/2,0,1)
        if 'radiusMM' in interior: inner*=np.clip((interior['radiusMM']-distance)/2,0,1)
        colour=colour*(1-inner[:,None])+np.array(interior['rgb'])*grain[:,None]*inner[:,None]
    colours=colours*(1-weight[:,None])+colour*weight[:,None]
    roughness=roughness*(1-weight)+.93*weight
    attr=obj.data.color_attributes.new('Masonry','FLOAT_COLOR','POINT')
    attr.data.foreach_set('color',np.column_stack([weight,weight,weight,np.ones(len(weight))]).astype(np.float32).ravel())
    print('MASONRY_REFERENCE',np.quantile(distances,[.1,.5,.9,1]).tolist(),float(weight.mean()),flush=True)
    return colours,roughness
