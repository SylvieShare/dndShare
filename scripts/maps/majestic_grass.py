"""Olive grass, pale blade tips and earth sides, guided by the pack PDF."""
import bpy
import numpy as np


def paint(obj, recipe=None, code=None):
    recipe = recipe or {}
    mesh = obj.data
    positions = np.empty(len(mesh.vertices)*3, np.float32)
    mesh.vertices.foreach_get('co', positions)
    x, y, z = positions.reshape(-1, 3).T
    t = np.clip((z-14.15)/.55, 0, 1)
    t = t*t*(3-2*t)
    if recipe.get('baseSurface') == 'soil': t[:] = 0
    from majestic_surface import grass_weights
    coverage = grass_weights(obj, recipe, code)
    t *= coverage
    tip = np.clip((z-14.75)/1.55, 0, 1)*.7
    variation = 1 + .06*np.sin(x*.17+y*.21) + .04*np.sin(x*.41-y*.33)
    soil_side = np.array([.255, .185, .115])
    soil_top = np.array(recipe.get('soilTopRGB', soil_side))
    soil_mix = np.clip((z-recipe.get('soilTopStartMM',13.7))/recipe.get('soilTopFadeMM',1.2), 0, 1)
    soil = soil_side[None,:]*(1-soil_mix[:,None])+soil_top[None,:]*soil_mix[:,None]
    patch = (np.sin(x*.13+y*.09)+np.sin(x*.23-y*.11)+2)/4
    grass = (1-patch[:, None])*np.array([.275, .37, .13]) + patch[:, None]*np.array([.36, .405, .145])
    dry = np.array([.57, .585, .245])
    rgb = (soil*(1-t[:, None]) +
           ((1-tip[:, None])*grass + tip[:, None]*dry)*t[:, None])
    rgb = np.clip(rgb*variation[:, None], .04, .9)
    roughness = .97-.03*t if recipe.get('grassReference') or recipe.get('soilReference') or recipe.get('soilDomains') or recipe.get('baseSurface')=='soil' else np.full(len(x),.94)
    if recipe.get('trees') or recipe.get('ferns') or recipe.get('stones'):
        from majestic_pines import apply_pines
        rgb, roughness = apply_pines(obj, positions.reshape(-1,3), rgb, roughness, coverage, recipe)
    if recipe.get('masonryReference'):
        from majestic_masonry import apply_masonry
        rgb, roughness = apply_masonry(obj, positions.reshape(-1,3), rgb, roughness, recipe)
    if recipe.get('roundedAccents'):
        from majestic_accents import apply_accents
        rgb, roughness = apply_accents(positions.reshape(-1,3), rgb, roughness, recipe)
    metallic = np.zeros(len(x),np.float32)
    if recipe.get('woodReference'):
        from majestic_wood import apply_wood
        rgb, roughness, metallic = apply_wood(obj, positions.reshape(-1,3), rgb, roughness, recipe)
    if recipe.get('camp'):
        from majestic_camp import apply_camp
        rgb, roughness = apply_camp(obj,positions.reshape(-1,3),rgb,roughness,recipe)
    if recipe.get('fungiReference'):
        from majestic_fungi import apply_fungi
        rgb, roughness = apply_fungi(obj,positions.reshape(-1,3),rgb,roughness,recipe)
    if recipe.get('boneReference'):
        from majestic_bones import apply_bones
        rgb, roughness = apply_bones(obj,positions.reshape(-1,3),rgb,roughness,recipe)
    if recipe.get('water'):
        from majestic_water import apply_water
        rgb, roughness = apply_water(obj,positions.reshape(-1,3),rgb,roughness,recipe)
    linear = np.where(rgb <= .04045, rgb/12.92, ((rgb+.055)/1.055)**2.4)
    attribute = mesh.color_attributes.new('Paint', 'FLOAT_COLOR', 'POINT')
    attribute.data.foreach_set('color', np.column_stack([linear, np.ones(len(x))]).astype(np.float32).ravel())
    surface = mesh.color_attributes.new('Surface', 'FLOAT_COLOR', 'POINT')
    surface.data.foreach_set('color', np.column_stack([np.ones(len(x)), roughness, metallic, np.ones(len(x))]).astype(np.float32).ravel())


def material(recipe=None):
    recipe = recipe or {}
    mat = bpy.data.materials.new('Majestic grass and earth')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    colour = nodes.new('ShaderNodeVertexColor'); colour.layer_name = 'Paint'
    coords = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 2.0
    noise.inputs['Detail'].default_value = 3
    links.new(coords.outputs['Object'], noise.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (.82, .82, .82, 1)
    ramp.color_ramp.elements[1].color = (1.12, 1.12, 1.12, 1)
    links.new(noise.outputs['Fac'], ramp.inputs[0])
    mix = nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1
    links.new(colour.outputs['Color'], mix.inputs[1]); links.new(ramp.outputs['Color'], mix.inputs[2])
    geometry = nodes.new('ShaderNodeNewGeometry')
    wear = nodes.new('ShaderNodeValToRGB')
    wear.color_ramp.elements[0].position = .455
    wear.color_ramp.elements[0].color = (.75, .75, .75, 1)
    wear.color_ramp.elements[1].position = .545
    wear.color_ramp.elements[1].color = (1.2, 1.2, 1.2, 1)
    links.new(geometry.outputs['Pointiness'], wear.inputs[0])
    finish = nodes.new('ShaderNodeMixRGB'); finish.blend_type = 'MULTIPLY'; finish.inputs[0].default_value = 1
    links.new(mix.outputs[0], finish.inputs[1]); links.new(wear.outputs['Color'], finish.inputs[2])
    if recipe.get('darkenJoints'):
        mask=nodes.new('ShaderNodeVertexColor');mask.layer_name='Masonry'
        ao=nodes.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=.9;ao.samples=16
        remap=nodes.new('ShaderNodeMath');remap.operation='MULTIPLY_ADD';remap.inputs[1].default_value=.45;remap.inputs[2].default_value=.55
        links.new(ao.outputs['AO'],remap.inputs[0])
        dirt=nodes.new('ShaderNodeMixRGB');dirt.blend_type='MULTIPLY'
        links.new(mask.outputs['Color'],dirt.inputs[0]);links.new(finish.outputs[0],dirt.inputs[1]);links.new(remap.outputs[0],dirt.inputs[2])
        finish=dirt
    if recipe.get('woodReference'):
        from majestic_wood import wood_finish
        finish=wood_finish(nodes,links,finish,recipe)
    if recipe.get('boneReference'):
        from majestic_bones import bone_finish
        finish=bone_finish(nodes,links,finish,recipe)
    shader = nodes.get('Principled BSDF')
    links.new(finish.outputs[0], shader.inputs['Base Color'])
    shader.inputs['Roughness'].default_value = .94
    return mat
