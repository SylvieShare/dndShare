"""Individually measured stone and earth surfaces for Medieval Town."""
import bpy
import bmesh
import json
from pathlib import Path
import numpy as np
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree


def stone_islands(obj, settings):
    """Measure separated stone caps; colour variation follows the sculpt."""
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    remaining = {v for v in bm.verts if v.co.z>settings['stoneIslandMM']}
    centers = []
    while remaining:
        start = remaining.pop(); stack = [start]; component = [start]
        while stack:
            vertex = stack.pop()
            for edge in vertex.link_edges:
                other = edge.other_vert(vertex)
                if other in remaining:
                    remaining.remove(other); stack.append(other); component.append(other)
        if len(component)>=settings.get('stoneIslandMinVertices', 100):
            centers.append(np.mean([v.co[:] for v in component], axis=0))
    bm.free()
    if len(centers)<settings.get('stoneIslandMinCount', 4):
        raise ValueError('Stone cap threshold did not separate the pavement')
    tree = KDTree(len(centers))
    for i, p in enumerate(centers): tree.insert(p, i)
    tree.balance()
    colors = np.array([.88+.24*((np.sin(p[0]*12.9898+p[1]*78.233)*43758.5453)%1)
                       for p in centers], np.float32)
    variation = np.array([colors[tree.find(v.co)[1]] for v in obj.data.vertices], np.float32)
    print('MEDIEVAL_STONE_ISLANDS', len(centers), flush=True)
    return variation


def paint(obj, recipe):
    if recipe['materials'].get('kind')=='torch':
        from medieval_torch import paint as paint_torch
        paint_torch(obj, recipe)
        return
    if recipe['materials'].get('kind')=='wood-floor':
        from medieval_wood import paint as paint_wood
        paint_wood(obj, recipe)
        return
    mesh = obj.data
    positions = np.empty(len(mesh.vertices)*3, np.float32)
    mesh.vertices.foreach_get('co', positions)
    x, y, z = positions.reshape(-1, 3).T
    settings = recipe['materials']
    # Height thresholds are measured per source, in native STL millimetres.
    stone = np.clip((z-settings['stoneStartMM'])/settings['stoneBlendMM'], 0, 1)
    stone = stone*stone*(3-2*stone)
    patch = .5+.23*np.sin(x*.23+y*.31)+.16*np.sin(x*.49-y*.19)
    grain = 1+.035*np.sin(x*1.77+y*1.39+z*.53)
    sand = np.array(settings['earthRGB'])*(1+.08*np.sin(x*.39-y*.27))[:, None]
    rock = (np.array(settings['stoneDarkRGB'])*(1-patch[:, None])+
            np.array(settings['stoneLightRGB'])*patch[:, None])*grain[:, None]
    if settings.get('stoneIslandMM') is not None:
        rock *= stone_islands(obj, settings)[:, None]
    rgb = np.clip(sand*(1-stone[:, None])+rock*stone[:, None], .02, .95)
    roughness = .96-.06*stone
    if settings.get('earthReference'):
        reference = settings['earthReference']
        root = Path(__file__).resolve().parents[2]
        rows = json.loads((root/'models/collections/medieval-town-vol1/inventory.json').read_text())
        row = next(r for r in rows if r['code']==reference['code'])
        bpy.ops.wm.stl_import(filepath=str(root/'models'/row['sourcePath']))
        other = bpy.context.object
        tree = BVHTree.FromObject(other, bpy.context.evaluated_depsgraph_get())
        distances = np.array([tree.find_nearest(v.co)[3] for v in obj.data.vertices], np.float32)
        bpy.data.objects.remove(other, do_unlink=True)
        weight = np.clip((distances-reference['matchMM'])/reference['blendMM'], 0, 1)
        weight = weight*weight*(3-2*weight)
        weight *= (z>=reference['minZMM'])&(x>=reference['xMM'][0])&(x<=reference['xMM'][1])&(y>=reference['yMM'][0])&(y<=reference['yMM'][1])
        rubble = np.array(settings['rubbleRGB'])*(1+.12*np.sin(x*1.35+y*.71+z*2.11))[:, None]
        rgb = rgb*(1-weight[:, None])+rubble*weight[:, None]
        roughness = roughness*(1-weight)+.96*weight
        print('MEDIEVAL_ADDED_EARTH', float(weight.mean()), np.quantile(distances, [.1, .5, .9, 1]).tolist(), flush=True)
    linear = np.where(rgb<=.04045, rgb/12.92, ((rgb+.055)/1.055)**2.4)
    attr = mesh.color_attributes.new('Paint', 'FLOAT_COLOR', 'POINT')
    attr.data.foreach_set('color', np.column_stack([linear, np.ones(len(x))]).astype(np.float32).ravel())
    surface = mesh.color_attributes.new('Surface', 'FLOAT_COLOR', 'POINT')
    surface.data.foreach_set('color', np.column_stack([np.ones(len(x)), roughness,
                                                     np.zeros(len(x)), np.ones(len(x))]).astype(np.float32).ravel())


def material(recipe):
    mat = bpy.data.materials.new('Medieval worn sandstone and earth')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    colour = nodes.new('ShaderNodeVertexColor'); colour.layer_name = 'Paint'
    coords = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 2.5
    noise.inputs['Detail'].default_value = 3
    links.new(coords.outputs['Object'], noise.inputs['Vector'])
    variation = nodes.new('ShaderNodeValToRGB')
    variation.color_ramp.elements[0].color = (.89, .89, .89, 1)
    variation.color_ramp.elements[1].color = (1.08, 1.08, 1.08, 1)
    links.new(noise.outputs['Fac'], variation.inputs[0])
    mix = nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1
    links.new(colour.outputs['Color'], mix.inputs[1]); links.new(variation.outputs[0], mix.inputs[2])
    ao = nodes.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = recipe['materials']['jointDistanceMM']
    ao.samples = 16
    remap = nodes.new('ShaderNodeMath'); remap.operation = 'MULTIPLY_ADD'
    remap.inputs[1].default_value = .4; remap.inputs[2].default_value = .6
    links.new(ao.outputs['AO'], remap.inputs[0])
    finish = nodes.new('ShaderNodeMixRGB'); finish.blend_type = 'MULTIPLY'; finish.inputs[0].default_value = 1
    links.new(mix.outputs[0], finish.inputs[1]); links.new(remap.outputs[0], finish.inputs[2])
    links.new(finish.outputs[0], shader.inputs['Base Color'])
    shader.inputs['Roughness'].default_value = .93
    return mat
