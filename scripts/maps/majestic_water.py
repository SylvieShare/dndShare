"""Paint measured sculpted water without recolouring banks or overhanging arches."""
import json
from pathlib import Path
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree


def shoreline_distance(positions, points):
    distance=np.full(len(positions),np.inf);side=np.zeros(len(positions))
    for a,b in zip(points,points[1:]):
        a,b=np.array(a),np.array(b);edge=b-a
        if edge@edge<1e-8: raise ValueError('Distinct shoreline points required')
        t=np.clip(((positions[:,:2]-a)*edge).sum(1)/(edge@edge),0,1)
        candidate=np.linalg.norm(positions[:,:2]-a-t[:,None]*edge,axis=1)
        delta=positions[:,:2]-a
        signed=(edge[0]*delta[:,1]-edge[1]*delta[:,0])/np.linalg.norm(edge)
        side=np.where(candidate<distance,signed,side)
        distance=np.minimum(distance,candidate)
    return distance,side


def apply_water(obj, positions, colours, roughness, recipe):
    root=Path(__file__).resolve().parents[2]
    settings=recipe['water']
    original_colours=colours.copy();original_roughness=roughness.copy()
    bank_stones = np.zeros(len(positions), np.float32)
    if settings.get('bankStoneSurfaces'):
        from majestic_vegetation_surface import stone_surface_mask
        for area in settings['bankStoneSurfaces']:
            stone = stone_surface_mask(obj.data, positions, area)
            if area.get('pointsMM'):
                from majestic_surface import polygon_weight
                stone *= polygon_weight(positions, area['pointsMM'], area.get('featherMM', .5))
            bank_stones = np.maximum(bank_stones, stone)
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
            low=np.clip((stone.get('waterRestoreMaxZMM',settings['restoreLowWaterAroundStonesMM'])-z)/.2,0,1)
            weight=np.maximum(weight,near*low)
    if settings.get('restoreLowWaterAroundBanksMM'):
        for bank in settings.get('banks',[]):
            radius=np.linalg.norm((positions[:,:2]-np.array(bank['centreMM']))/np.array(bank['radiiMM']),axis=1)
            near=np.clip((1.7-radius)/.25,0,1)*np.clip((radius-.75)/.15,0,1)
            low=np.clip((settings['restoreLowWaterAroundBanksMM']-z)/.2,0,1)
            weight=np.maximum(weight,near*low)
    if settings.get('lowWaterDomain'):
        from majestic_surface import polygon_weight
        area=settings['lowWaterDomain']
        near=polygon_weight(positions,area['pointsMM'],area.get('featherMM',.5))
        near_domain=near
        low=np.clip((area['maxZMM']-z)/.2,0,1)
        weight=np.maximum(weight,near*low)
    shorelines=[(shore,*shoreline_distance(positions,shore['pointsMM'])) for shore in settings.get('shorelines',[])]
    for shore,distance,side in shorelines:
        near=np.clip((shore['waterRestoreWidthMM']-distance)/2,0,1)
        low=np.clip((shore['waterRestoreMaxZMM']-z)/.2,0,1)
        weight=np.maximum(weight,near*low)
    weight*=np.clip((z-settings['minZMM'])/.35,0,1)*np.clip((normals[:,2]-settings.get('normalMin',.05))/settings.get('normalFade',.2),0,1)
    if settings.get('clipToLowWaterDomain'):
        weight*=near_domain
    if settings.get('preserveWood'):
        attribute=obj.data.color_attributes.get('Wood')
        if attribute is None: raise ValueError('Measured wood mask required before water protection')
        wood=np.empty(len(positions)*4,np.float32);attribute.data.foreach_get('color',wood)
        weight*=1-np.clip(wood.reshape(-1,4)[:,0],0,1)
    if settings.get('boundsMM'):
        lo,hi=np.array(settings['boundsMM'][0]),np.array(settings['boundsMM'][1])
        weight*=np.all((positions>=lo)&(positions<=hi),axis=1)
    weight *= 1-bank_stones
    height=np.clip((z-settings['lowZMM'])/(settings['highZMM']-settings['lowZMM']),0,1)
    if settings.get('surfaceBands'):
        from water_surface_bands import water_surface_bands
        band_weight, height = water_surface_bands(positions, settings['surfaceBands'])
        weight *= band_weight
        # Bands are painted by water_band_finish/ORM at the baked surface point.
        # Vertex water colour would still leak beyond the bands after decimation.
        weight[:] = 0
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
        if 'forceAboveMM' in stone:
            cap=np.clip((z-stone['forceAboveMM'])/.12,0,1)*np.clip((.68-radius)/.12,0,1)
            stone_weight=np.maximum(stone_weight,cap)
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
    if any('maxZMM' in shore for shore,_,_ in shorelines):
        rgb=np.clip(colours,0,1)
        linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
        attribute=obj.data.color_attributes.new('Before Shoreline','FLOAT_COLOR','POINT')
        attribute.data.foreach_set('color',np.column_stack([linear,np.ones(len(linear))]).astype(np.float32).ravel())
    for shore,distance,side in shorelines:
        shore_weight=np.clip((shore['stoneWidthMM']-distance)/.8,0,1)*np.clip((z-shore['minZMM'])/.4,0,1)*(1-weight)
        if 'maxZMM' in shore:
            shore_weight*=np.clip((shore['maxZMM']-z)/shore.get('heightFadeMM',.5),0,1)
        if 'landwardWidthMM' in shore: shore_weight*=np.clip((shore['landwardWidthMM']-side)/.8,0,1)
        shade=1+.045*np.sin(x*.51+y*.43+z*.21)
        colours=colours*(1-shore_weight[:,None])+np.array(shore['rgb'])*shade[:,None]*shore_weight[:,None]
        roughness=roughness*(1-shore_weight)+.88*shore_weight
    for box in settings.get('plantKeepBoxes',[]):
        lo,hi=np.array(box['minMM']),np.array(box['maxMM'])
        keep=np.clip(np.minimum(positions-lo,hi-positions).min(1)/box.get('featherMM',.2),0,1)
        colours=colours*(1-keep[:,None])+original_colours*keep[:,None]
        roughness=roughness*(1-keep)+original_roughness*keep
    if settings.get('bankStoneSurfaces'):
        colours = colours*(1-bank_stones[:,None]) + np.array(settings.get('bankStoneRGB', [.415,.435,.39]))*bank_stones[:,None]
        roughness = roughness*(1-bank_stones) + settings.get('bankStoneRoughness', .88)*bank_stones
    if settings.get('preserveWood'):
        timber=np.clip(wood.reshape(-1,4)[:,0],0,1)
        colours=colours*(1-timber[:,None])+original_colours*timber[:,None]
        roughness=roughness*(1-timber)+original_roughness*timber
    print('WATER_REFERENCE',np.quantile(distances,[0,.25,.5,.75,.9,1]).tolist(),int((weight>.5).sum()),flush=True)
    return colours,roughness


def shoreline_height_finish(nodes, links, finish, recipe, noise, wear):
    bounded=[s for s in recipe.get('water',{}).get('shorelines',[]) if 'maxZMM' in s]
    if not bounded: return finish
    coords=nodes.new('ShaderNodeTexCoord');position=nodes.new('ShaderNodeSeparateXYZ')
    links.new(coords.outputs['Object'],position.inputs[0])
    ceiling=max(s['maxZMM'] for s in bounded)
    height=nodes.new('ShaderNodeMapRange');height.clamp=True
    height.inputs['From Min'].default_value=ceiling
    height.inputs['From Max'].default_value=ceiling+.35
    links.new(position.outputs['Z'],height.inputs['Value'])
    original=nodes.new('ShaderNodeVertexColor');original.layer_name='Before Shoreline'
    grain=nodes.new('ShaderNodeMixRGB');grain.blend_type='MULTIPLY';grain.inputs[0].default_value=1
    links.new(original.outputs['Color'],grain.inputs[1]);links.new(noise,grain.inputs[2])
    worn=nodes.new('ShaderNodeMixRGB');worn.blend_type='MULTIPLY';worn.inputs[0].default_value=1
    links.new(grain.outputs[0],worn.inputs[1]);links.new(wear,worn.inputs[2])
    repaired=nodes.new('ShaderNodeMixRGB');links.new(height.outputs['Result'],repaired.inputs[0])
    links.new(finish.outputs[0],repaired.inputs[1]);links.new(worn.outputs[0],repaired.inputs[2])
    return repaired


def water_band_finish(nodes, links, finish, recipe):
    """Paint water per baked surface point; long LOD triangles must not mix rock into pools."""
    settings = recipe['water']
    def scalar(op, a, b):
        node = nodes.new('ShaderNodeMath'); node.operation = op
        for i, value in enumerate([a, b]):
            if isinstance(value, (int, float)): node.inputs[i].default_value = value
            else: links.new(value, node.inputs[i])
        return node.outputs[0]
    def clamp(value): return scalar('MINIMUM', scalar('MAXIMUM', value, 0), 1)
    coords = nodes.new('ShaderNodeTexCoord'); position = nodes.new('ShaderNodeSeparateXYZ')
    links.new(coords.outputs['Object'], position.inputs[0])
    geometry = nodes.new('ShaderNodeNewGeometry'); normal = nodes.new('ShaderNodeSeparateXYZ')
    links.new(geometry.outputs['True Normal'], normal.inputs[0])
    facing = clamp(scalar('DIVIDE', scalar('SUBTRACT', normal.outputs['Z'], settings.get('normalMin', .05)), settings.get('normalFade', .2)))
    total = 0
    for band in settings['surfaceBands']:
        distance = scalar('MINIMUM', scalar('SUBTRACT', position.outputs['Z'], band['minZMM']), scalar('SUBTRACT', band['maxZMM'], position.outputs['Z']))
        weight = scalar('MULTIPLY', facing, clamp(scalar('DIVIDE', distance, band.get('heightFadeMM', .1))))
        if band.get('boundsXYMM'):
            for axis, lo, hi in zip('XY', *band['boundsXYMM']):
                inside = scalar('MULTIPLY', scalar('GREATER_THAN', position.outputs[axis], lo), scalar('LESS_THAN', position.outputs[axis], hi))
                weight = scalar('MULTIPLY', weight, inside)
        height = clamp(scalar('DIVIDE', scalar('SUBTRACT', position.outputs['Z'], band['lowZMM']), band['highZMM']-band['lowZMM']))
        colour = nodes.new('ShaderNodeMixRGB'); links.new(height, colour.inputs[0])
        for index, key in [(1, 'deepRGB'), (2, 'shallowRGB')]:
            rgb = np.array(settings[key]); linear = np.where(rgb<=.04045, rgb/12.92, ((rgb+.055)/1.055)**2.4)
            colour.inputs[index].default_value = (*linear, 1)
        repaired = nodes.new('ShaderNodeMixRGB'); links.new(weight, repaired.inputs[0])
        links.new(finish.outputs[0], repaired.inputs[1]); links.new(colour.outputs[0], repaired.inputs[2]); finish = repaired
        total = scalar('MAXIMUM', total, weight)
    mask = nodes.new('ShaderNodeMath'); mask.name = 'Majestic Water Surface Bands'; mask.operation = 'MULTIPLY'
    mask.inputs[1].default_value = 1; links.new(total, mask.inputs[0])
    return finish


def water_bands_orm(nodes, links, combine, surface, roughness, previous=None):
    if previous: previous(nodes, links, combine, surface)
    original = combine.inputs['Green'].links[0].from_socket
    difference = nodes.new('ShaderNodeMath'); difference.operation = 'SUBTRACT'; difference.inputs[0].default_value = roughness
    links.new(original, difference.inputs[1])
    delta = nodes.new('ShaderNodeMath'); delta.operation = 'MULTIPLY'
    links.new(difference.outputs[0], delta.inputs[0]); links.new(nodes.get('Majestic Water Surface Bands').outputs[0], delta.inputs[1])
    result = nodes.new('ShaderNodeMath'); result.operation = 'ADD'
    links.new(original, result.inputs[0]); links.new(delta.outputs[0], result.inputs[1]); links.new(result.outputs[0], combine.inputs['Green'])


def water_cap_finish(nodes, links, finish, recipe):
    if recipe['water'].get('surfaceBands'):
        finish = water_band_finish(nodes, links, finish, recipe)
    caps=[s for s in recipe['water'].get('stones',[]) if 'forceAboveMM' in s]
    if not caps: return finish
    def scalar(op,a,b):
        node=nodes.new('ShaderNodeMath');node.operation=op
        for i,v in enumerate([a,b]):
            if isinstance(v,(int,float)):node.inputs[i].default_value=v
            else:links.new(v,node.inputs[i])
        return node.outputs[0]
    def clamp(value): return scalar('MINIMUM',scalar('MAXIMUM',value,0),1)
    coords=nodes.new('ShaderNodeTexCoord');separate=nodes.new('ShaderNodeSeparateXYZ')
    links.new(coords.outputs['Object'],separate.inputs[0]);total=None
    for stone in caps:
        delta=nodes.new('ShaderNodeVectorMath');delta.operation='SUBTRACT'
        links.new(coords.outputs['Object'],delta.inputs[0]);delta.inputs[1].default_value=stone['centreMM']
        scaled=nodes.new('ShaderNodeVectorMath');scaled.operation='DIVIDE'
        links.new(delta.outputs['Vector'],scaled.inputs[0]);scaled.inputs[1].default_value=stone['radiiMM']
        length=nodes.new('ShaderNodeVectorMath');length.operation='LENGTH';links.new(scaled.outputs['Vector'],length.inputs[0])
        volume=clamp(scalar('DIVIDE',scalar('SUBTRACT',.68,length.outputs['Value']),.12))
        height=clamp(scalar('DIVIDE',scalar('SUBTRACT',separate.outputs['Z'],stone['forceAboveMM']),.12))
        cap=scalar('MULTIPLY',volume,height)
        painted=nodes.new('ShaderNodeMixRGB');links.new(cap,painted.inputs[0]);links.new(finish.outputs[0],painted.inputs[1])
        rgb=np.array(stone['rgb']);linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
        painted.inputs[2].default_value=(*linear,1);finish=painted
        total=cap if total is None else scalar('MAXIMUM',total,cap)
    mask=nodes.new('ShaderNodeMath');mask.name='Majestic Water Stone Cap';mask.operation='MULTIPLY'
    mask.inputs[1].default_value=1;links.new(total,mask.inputs[0])
    return finish


def water_caps_orm(nodes, links, combine, surface, previous=None):
    if previous: previous(nodes,links,combine,surface)
    original=combine.inputs['Green'].links[0].from_socket
    difference=nodes.new('ShaderNodeMath');difference.operation='SUBTRACT';difference.inputs[0].default_value=.82
    links.new(original,difference.inputs[1])
    delta=nodes.new('ShaderNodeMath');delta.operation='MULTIPLY'
    links.new(difference.outputs[0],delta.inputs[0]);links.new(nodes.get('Majestic Water Stone Cap').outputs[0],delta.inputs[1])
    rough=nodes.new('ShaderNodeMath');rough.operation='ADD'
    links.new(original,rough.inputs[0]);links.new(delta.outputs[0],rough.inputs[1]);links.new(rough.outputs[0],combine.inputs['Green'])
