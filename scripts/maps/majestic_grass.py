"""Olive grass, pale blade tips and earth sides, guided by the pack PDF."""
import bpy
import numpy as np


def paint(obj):
    mesh = obj.data
    positions = np.empty(len(mesh.vertices)*3, np.float32)
    mesh.vertices.foreach_get('co', positions)
    x, y, z = positions.reshape(-1, 3).T
    t = np.clip((z-14.15)/.55, 0, 1)
    t = t*t*(3-2*t)
    tip = np.clip((z-14.75)/1.55, 0, 1)*.7
    variation = 1 + .06*np.sin(x*.17+y*.21) + .04*np.sin(x*.41-y*.33)
    soil = np.array([.255, .185, .115])
    patch = (np.sin(x*.13+y*.09)+np.sin(x*.23-y*.11)+2)/4
    grass = (1-patch[:, None])*np.array([.275, .37, .13]) + patch[:, None]*np.array([.36, .405, .145])
    dry = np.array([.57, .585, .245])
    rgb = (soil[None, :]*(1-t[:, None]) +
           ((1-tip[:, None])*grass + tip[:, None]*dry)*t[:, None])
    rgb = np.clip(rgb*variation[:, None], .04, .9)
    linear = np.where(rgb <= .04045, rgb/12.92, ((rgb+.055)/1.055)**2.4)
    attribute = mesh.color_attributes.new('Paint', 'FLOAT_COLOR', 'POINT')
    attribute.data.foreach_set('color', np.column_stack([linear, np.ones(len(x))]).astype(np.float32).ravel())
    surface = mesh.color_attributes.new('Surface', 'FLOAT_COLOR', 'POINT')
    surface.data.foreach_set('color', np.tile([1, .94, 0, 1], (len(x), 1)).astype(np.float32).ravel())


def material():
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
    shader = nodes.get('Principled BSDF')
    links.new(finish.outputs[0], shader.inputs['Base Color'])
    shader.inputs['Roughness'].default_value = .94
    return mat
