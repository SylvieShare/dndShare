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
    if 'x' in bounds: region&=(x>=bounds['x'][0])&(x<=bounds['x'][1])
    if 'y' in bounds: region&=(y>=bounds['y'][0])&(y<=bounds['y'][1])
    weight*=region
    for box in recipe.get('masonryOverrides',[]):
        mask=(u>=box['u'][0])&(u<=box['u'][1])&(v>=box['v'][0])&(v<=box['v'][1])&(z>=box['z'][0])&(z<=box['z'][1])
        weight=np.maximum(weight,mask.astype(np.float32))
    normals=np.empty(len(obj.data.vertices)*3,np.float32)
    obj.data.vertices.foreach_get('normal',normals); normals=normals.reshape(-1,3)
    for box in recipe.get('masonryBoxes',[]):
        mask=(x>=box['x'][0])&(x<=box['x'][1])&(y>=box['y'][0])&(y<=box['y'][1])&(z>=box['z'][0])&(z<=box['z'][1])&(distances>box.get('referenceDeltaMM',.03))&(normals[:,2]>.55)
        weight=np.maximum(weight,mask.astype(np.float32))
    if recipe.get('raisedGrass'):
        cap=np.empty(len(positions)*4,np.float32);obj.data.color_attributes['RaisedGrass'].data.foreach_get('color',cap)
        weight*=1-np.clip(cap.reshape(-1,4)[:,0],0,1)
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


def masonry_back_finish(nodes, links, finish, recipe, noise, wear):
    settings=recipe.get('masonryBackFace')
    if not settings: return finish
    def scalar(op,a,b=None):
        node=nodes.new('ShaderNodeMath');node.operation=op
        for i,v in enumerate([a,b]):
            if v is None: continue
            if isinstance(v,(int,float)): node.inputs[i].default_value=v
            else: links.new(v,node.inputs[i])
        return node.outputs[0]
    def clamp(v):return scalar('MINIMUM',scalar('MAXIMUM',v,0),1)
    coords=nodes.new('ShaderNodeTexCoord');position=nodes.new('ShaderNodeSeparateXYZ');links.new(coords.outputs['Object'],position.inputs[0])
    geometry=nodes.new('ShaderNodeNewGeometry');normal=nodes.new('ShaderNodeSeparateXYZ');links.new(geometry.outputs['True Normal'],normal.inputs[0])
    distance=scalar('ABSOLUTE',scalar('SUBTRACT',position.outputs['X'],settings['xMM']))
    plane=clamp(scalar('DIVIDE',scalar('SUBTRACT',settings['distanceMM'],distance),.07))
    facing=clamp(scalar('DIVIDE',scalar('SUBTRACT',normal.outputs['X'],settings['normalXMin']),.015))
    height=clamp(scalar('DIVIDE',scalar('SUBTRACT',position.outputs['Z'],settings['minZMM']),.5))
    mask=scalar('MULTIPLY',scalar('MULTIPLY',plane,facing),height)
    rgb=np.array(recipe['masonryRGB']);linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
    colour=nodes.new('ShaderNodeMixRGB');colour.blend_type='MULTIPLY';colour.inputs[0].default_value=1;colour.inputs[1].default_value=(*linear,1);links.new(noise,colour.inputs[2])
    worn=nodes.new('ShaderNodeMixRGB');worn.blend_type='MULTIPLY';worn.inputs[0].default_value=1;links.new(colour.outputs[0],worn.inputs[1]);links.new(wear,worn.inputs[2]);colour=worn
    if recipe.get('darkenJoints'):
        ao=nodes.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=.9;ao.samples=16
        shade=scalar('ADD',scalar('MULTIPLY',ao.outputs['AO'],.45),.55)
        dirt=nodes.new('ShaderNodeMixRGB');dirt.blend_type='MULTIPLY';dirt.inputs[0].default_value=1;links.new(colour.outputs[0],dirt.inputs[1]);links.new(shade,dirt.inputs[2]);colour=dirt
    result=nodes.new('ShaderNodeMixRGB');links.new(mask,result.inputs[0]);links.new(finish.outputs[0],result.inputs[1]);links.new(colour.outputs[0],result.inputs[2])
    return result
