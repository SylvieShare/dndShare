"""Measured cart components, directional timber, wheel spokes and iron bands."""
import json
from pathlib import Path
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree


def apply_wood(obj, positions, colours, roughness, recipe):
    root=Path(__file__).resolve().parents[2]
    rows=json.loads((root/'models/collections/majestic-highlands/manifest.json').read_text())
    settings=recipe['woodReference']; row=next(r for r in rows if r['code']==settings['code'])
    bpy.ops.wm.stl_import(filepath=str(root/'models'/row['sourcePath']))
    reference=bpy.context.object;angle=np.deg2rad(settings['rotateZ']);c,s=np.cos(angle),np.sin(angle)
    for v in reference.data.vertices:
        x,y=v.co.x,v.co.y;v.co.x,v.co.y=x*c-y*s,x*s+y*c
    reference.data.update();tree=BVHTree.FromObject(reference,bpy.context.evaluated_depsgraph_get())
    distances=np.array([tree.find_nearest(v.co)[3] for v in obj.data.vertices],np.float32)
    bpy.data.objects.remove(reference,do_unlink=True)
    weight=np.clip((distances-settings['matchMM'])/settings['blendMM'],0,1)
    weight=weight*weight*(3-2*weight);weight*=positions[:,2]>recipe.get('woodMinZMM',15.1)
    directions=np.tile(np.array(recipe['woodDirection']), (len(positions),1))
    for part in recipe.get('woodParts',[]):
        mask=np.all((positions>=part['minMM'])&(positions<=part['maxMM']),axis=1)
        directions[mask]=part['direction']
    directions/=np.linalg.norm(directions,axis=1)[:,None]
    along=(positions*directions).sum(1)
    across=positions[:,0]*directions[:,1]-positions[:,1]*directions[:,0]
    grain=.93+.075*np.sin(across*4.4+.24*np.sin(along*.19))+.025*np.sin(across*15.7+along*.035)
    board=1+.06*np.sin(across*.48+positions[:,2]*.09)
    timber=np.array(recipe.get('woodRGB',[.47,.325,.18]))*(grain*board)[:,None]
    metal=np.zeros(len(positions),np.float32)
    normals=np.array([tuple(v.normal) for v in obj.data.vertices])
    end_mask=(np.abs((normals*directions).sum(1))>.82).astype(np.float32)
    end_radius=np.hypot(across-np.round(across/6)*6,positions[:,2]-np.round(positions[:,2]/6)*6)
    for wheel in recipe.get('wheels',[]):
        normal=np.array(wheel['normal']);normal/=np.linalg.norm(normal)
        delta=positions-np.array(wheel['centreMM']);axial=delta@normal
        plane=delta-axial[:,None]*normal;radial=np.linalg.norm(plane,axis=1)
        domain=(np.abs(axial)<wheel['halfThicknessMM'])&(radial<wheel['radiusMM']+.8)
        u=np.cross(normal,[0,1,0]);u/=np.linalg.norm(u);v=np.cross(normal,u)
        theta=np.arctan2(plane@v,plane@u)
        spokes=.94+.07*np.sin(theta*94+.16*np.sin(radial*.45))
        rim=.94+.065*np.sin(radial*6.2+.20*np.sin(theta*11))
        endgrain=.93+.08*np.sin(radial*8.7+.2*np.sin(theta*5))
        wheelgrain=np.where(radial>wheel['radiusMM']-2.5,rim,spokes)
        wheelgrain=np.where((radial<3.2)&(np.abs(normals@normal)>.7),endgrain,wheelgrain)
        timber[domain]=np.array([.40,.285,.145])*wheelgrain[domain,None]
        along[domain]=radial[domain];across[domain]=theta[domain]*wheel['radiusMM']
        rim_domain=domain&(radial>wheel['radiusMM']-2.5)
        along[rim_domain]=theta[rim_domain]*wheel['radiusMM'];across[rim_domain]=radial[rim_domain]
        end_mask[domain]=((radial[domain]<3.2)&(np.abs(normals[domain]@normal)>.7))
        end_radius[domain]=radial[domain]
        band=np.clip((radial-(wheel['radiusMM']-wheel['ironBandMM']))/.6,0,1)*domain
        hub=np.clip((wheel.get('ironHubRadiusMM',0)-radial)/.4,0,1)*domain*(np.abs(axial)>wheel.get('hubFaceMM',1.4))
        metal=np.maximum(metal,np.maximum(band,hub)*weight)
    colours=colours*(1-weight[:,None])+timber*weight[:,None]
    roughness=roughness*(1-weight)+.87*weight
    for name,values in [('Wood',np.column_stack([weight]*3)),('WoodEnd',np.column_stack([end_mask]*3)),('WoodCoordinates',np.column_stack([(across+100)/200,(along+100)/200,end_radius/100]))]:
        attribute=obj.data.color_attributes.new(name,'FLOAT_COLOR','POINT')
        attribute.data.foreach_set('color',np.column_stack([values,np.ones(len(weight))]).astype(np.float32).ravel())
    print('WOOD_REFERENCE',np.quantile(distances,[.1,.5,.9,1]).tolist(),'wood/iron',float(weight.mean()),float(metal.mean()),flush=True)
    return colours,roughness,np.zeros(len(positions),np.float32)


def wood_finish(nodes, links, finish, recipe):
    """Bake sub-vertex grain from continuous per-component coordinates."""
    def math_node(operation, source, a=None, b=None):
        node=nodes.new('ShaderNodeMath');node.operation=operation
        links.new(source,node.inputs[0])
        if a is not None:node.inputs[1].default_value=a
        if b is not None:node.inputs[2].default_value=b
        return node.outputs[0]
    coords=nodes.new('ShaderNodeVertexColor');coords.layer_name='WoodCoordinates'
    channels=nodes.new('ShaderNodeSeparateColor');links.new(coords.outputs['Color'],channels.inputs['Color'])
    across=math_node('MULTIPLY_ADD',channels.outputs['Red'],200,-100)
    along=math_node('MULTIPLY_ADD',channels.outputs['Green'],200,-100)
    warp=math_node('SINE',math_node('MULTIPLY',along,.23))
    warp=math_node('MULTIPLY',warp,.20)
    frequency=math_node('MULTIPLY',across,3.8)
    total=nodes.new('ShaderNodeMath');total.operation='ADD';links.new(frequency,total.inputs[0]);links.new(warp,total.inputs[1])
    grain=math_node('MULTIPLY_ADD',math_node('SINE',total.outputs[0]),.10,.94)
    rings=math_node('MULTIPLY_ADD',math_node('SINE',math_node('MULTIPLY',channels.outputs['Blue'],780)),.10,.94)
    end=nodes.new('ShaderNodeVertexColor');end.layer_name='WoodEnd'
    shape=nodes.new('ShaderNodeMixRGB');links.new(end.outputs['Color'],shape.inputs[0]);links.new(grain,shape.inputs[1]);links.new(rings,shape.inputs[2])
    mask=nodes.new('ShaderNodeVertexColor');mask.layer_name='Wood'
    colour=nodes.new('ShaderNodeMixRGB');colour.blend_type='MULTIPLY'
    links.new(mask.outputs['Color'],colour.inputs[0]);links.new(finish.outputs[0],colour.inputs[1]);links.new(shape.outputs[0],colour.inputs[2])
    iron=iron_mask(nodes,links,recipe,mask.outputs['Color'])
    painted=nodes.new('ShaderNodeMixRGB')
    links.new(iron,painted.inputs[0]);links.new(colour.outputs[0],painted.inputs[1])
    rgb=np.array([.225,.235,.225]);linear=((rgb+.055)/1.055)**2.4
    painted.inputs[2].default_value=(*linear,1)
    return painted


def iron_mask(nodes, links, recipe, wood):
    def scalar(op, a, b=None):
        node=nodes.new('ShaderNodeMath');node.operation=op
        for value,index in [(a,0),(b,1)]:
            if value is None:continue
            if isinstance(value,(float,int)):node.inputs[index].default_value=value
            else:links.new(value,node.inputs[index])
        return node.outputs[0]
    def vector(op, a, b=None):
        node=nodes.new('ShaderNodeVectorMath');node.operation=op
        for value,index in [(a,0),(b,1)]:
            if value is None:continue
            if isinstance(value,(tuple,list,np.ndarray)):node.inputs[index].default_value=tuple(value)
            else:links.new(value,node.inputs[index])
        return node
    coords=nodes.new('ShaderNodeTexCoord'); result=None
    for wheel in recipe['wheels']:
        normal=np.array(wheel['normal']);normal/=np.linalg.norm(normal)
        delta=vector('SUBTRACT',coords.outputs['Object'],wheel['centreMM']).outputs['Vector']
        axial=vector('DOT_PRODUCT',delta,normal).outputs['Value']
        scaled=vector('SCALE',normal);links.new(axial,scaled.inputs[3])
        plane=vector('SUBTRACT',delta,scaled.outputs['Vector']).outputs['Vector']
        radial=vector('LENGTH',plane).outputs['Value'];absolute=scalar('ABSOLUTE',axial)
        domain=scalar('MULTIPLY',scalar('LESS_THAN',absolute,wheel['halfThicknessMM']),scalar('LESS_THAN',radial,wheel['radiusMM']+.8))
        band=scalar('MULTIPLY',scalar('SUBTRACT',radial,wheel['radiusMM']-wheel['ironBandMM']),1/.6)
        band=scalar('MINIMUM',scalar('MAXIMUM',band,0),1)
        hub=scalar('MULTIPLY',scalar('SUBTRACT',wheel.get('ironHubRadiusMM',0),radial),1/.4)
        hub=scalar('MINIMUM',scalar('MAXIMUM',hub,0),1)
        hub=scalar('MULTIPLY',hub,scalar('GREATER_THAN',absolute,wheel['hubFaceMM']))
        part=scalar('MULTIPLY',scalar('MAXIMUM',band,hub),domain)
        result=part if result is None else scalar('MAXIMUM',result,part)
    node=nodes.new('ShaderNodeMath');node.name='Majestic Iron Mask';node.operation='MULTIPLY'
    links.new(result,node.inputs[0]);links.new(wood,node.inputs[1])
    return node.outputs[0]


def iron_orm(nodes, links, combine, surface):
    mask=nodes.get('Majestic Iron Mask').outputs[0]
    metallic=nodes.new('ShaderNodeMath');metallic.operation='MULTIPLY';metallic.inputs[1].default_value=.82
    links.new(mask,metallic.inputs[0]);links.new(metallic.outputs[0],combine.inputs['Blue'])
    difference=nodes.new('ShaderNodeMath');difference.operation='SUBTRACT';difference.inputs[1].default_value=.68
    links.new(surface.outputs['Green'],difference.inputs[0])
    delta=nodes.new('ShaderNodeMath');delta.operation='MULTIPLY'
    links.new(difference.outputs[0],delta.inputs[0]);links.new(mask,delta.inputs[1])
    rough=nodes.new('ShaderNodeMath');rough.operation='SUBTRACT'
    links.new(surface.outputs['Green'],rough.inputs[0]);links.new(delta.outputs[0],rough.inputs[1]);links.new(rough.outputs[0],combine.inputs['Green'])
