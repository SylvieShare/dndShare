"""Individual canvas, bedding, ropes and flame masks for the measured camp."""
import json
from pathlib import Path
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree


def segment_distance(points,a,b):
    a,b=np.array(a),np.array(b);d=b-a;t=np.clip(((points-a)*d).sum(1)/(d@d),0,1)
    return np.linalg.norm(points-a-t[:,None]*d,axis=1)


def apply_camp(obj, positions, colours, roughness, recipe):
    x,y,z=positions.T;camp=recipe['camp'];weight=np.zeros(len(z),np.float32)
    wood_attribute=obj.data.color_attributes.get('Wood')
    basis=np.ones(len(z),np.float32)
    if wood_attribute:
        values=np.empty(len(z)*4,np.float32);wood_attribute.data.foreach_get('color',values);basis=values[::4]
    for part in camp['fabric']:
        domain=np.all((positions>=part['minMM'])&(positions<=part['maxMM']),axis=1)
        mask=domain.astype(np.float32)*np.clip((z-part.get('minZMM',15.2))/.45,0,1)
        mask*=basis
        for pole in camp.get('poles',[]):mask*=segment_distance(positions,pole['fromMM'],pole['toMM'])>pole['radiusMM']
        variation=1+.035*np.sin(x*.3+y*.17+z*.13)
        rgb=np.array(part['rgb'])*variation[:,None]
        colours=colours*(1-mask[:,None])+rgb*mask[:,None]
        roughness=roughness*(1-mask)+part.get('roughness',.96)*mask
        weight=np.maximum(weight,mask)
    for pillow in camp.get('pillows',[]):
        if 'minMM' in pillow:
            mask=np.all((positions>=pillow['minMM'])&(positions<=pillow['maxMM']),axis=1).astype(np.float32)
        else:
            d=((positions-np.array(pillow['centreMM']))/np.array(pillow['radiiMM']))**2
            mask=np.clip((1.1-d.sum(1))/.2,0,1)*basis
        colours=colours*(1-mask[:,None])+np.array(pillow['rgb'])*mask[:,None]
        roughness=roughness*(1-mask)+.95*mask;weight=np.maximum(weight,mask)
    for rope in camp.get('ropes',[]):
        d=np.linalg.norm(positions-np.array(rope['centreMM']),axis=1)
        mask=np.clip((rope['radiusMM']-d)/.3,0,1)*basis
        colours=colours*(1-mask[:,None])+np.array([.35,.285,.17])*mask[:,None]
        roughness=roughness*(1-mask)+.98*mask;weight=np.maximum(weight,mask)
    flame=np.zeros(len(z),np.float32)
    if recipe.get('flameReference'):
        root=Path(__file__).resolve().parents[2];rows=json.loads((root/'models/collections/majestic-highlands/manifest.json').read_text())
        row=next(r for r in rows if r['code']==recipe['flameReference'])
        bpy.ops.wm.stl_import(filepath=str(root/'models'/row['sourcePath']));reference=bpy.context.object
        tree=BVHTree.FromObject(reference,bpy.context.evaluated_depsgraph_get())
        distances=np.array([tree.find_nearest(v.co)[3] for v in obj.data.vertices],np.float32)
        bpy.data.objects.remove(reference,do_unlink=True)
        bounds=camp['flame'];domain=np.all((positions>=bounds['minMM'])&(positions<=bounds['maxMM']),axis=1)
        flame=np.clip((distances-.06)/.18,0,1)*domain*basis
        t=np.clip((z-bounds['baseZMM'])/(bounds['topZMM']-bounds['baseZMM']),0,1)
        rgb=np.array([1,.70,.10])*(1-t[:,None])+np.array([1,.36,.03])*t[:,None]
        colours=colours*(1-flame[:,None])+rgb*flame[:,None];roughness=roughness*(1-flame)+.85*flame
        weight=np.maximum(weight,flame)
        print('CAMP_FLAME',np.quantile(distances[domain],[0,.5,.9,1]).tolist(),float(flame.mean()),flush=True)
    wood=obj.data.color_attributes.get('Wood')
    if wood:
        values=np.empty(len(z)*4,np.float32);wood.data.foreach_get('color',values);values=values.reshape(-1,4);values[:,:3]*=1-weight[:,None];wood.data.foreach_set('color',values.ravel())
    attr=obj.data.color_attributes.new('Flame','FLOAT_COLOR','POINT')
    attr.data.foreach_set('color',np.column_stack([flame,flame,flame,np.ones(len(z))]).astype(np.float32).ravel())
    return colours,roughness


def bake_emission(target,directory,nodes,links,shader,output,strength=1):
    import tile_bake
    from tile_mesh import activate
    paint=nodes.new('ShaderNodeVertexColor');paint.layer_name='Paint'
    mask=nodes.new('ShaderNodeVertexColor');mask.layer_name='Flame'
    colour=nodes.new('ShaderNodeMixRGB');colour.blend_type='MULTIPLY';colour.inputs[0].default_value=1
    links.new(paint.outputs['Color'],colour.inputs[1]);links.new(mask.outputs['Color'],colour.inputs[2])
    emit=nodes.new('ShaderNodeEmission');links.new(colour.outputs[0],emit.inputs['Color']);links.new(emit.outputs[0],output.inputs['Surface'])
    image=tile_bake.texture(nodes,'Emission',(0,0,0,1));activate(target)
    bpy.ops.object.bake(type='EMIT',use_selected_to_active=False,margin=8,use_clear=False)
    tile_bake.save(image,directory,'emission')
    links.new(shader.outputs[0],output.inputs['Surface']);links.new(image.outputs['Color'],shader.inputs['Emission Color']);shader.inputs['Emission Strength'].default_value=strength
