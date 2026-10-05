"""Bake self-colour (no projection holes), detail normals and packed PBR maps."""
import bpy
import numpy as np
from tile_mesh import activate

SIZE = 1024


def texture(nodes, name, neutral, data=False):
    image = bpy.data.images.new(name, width=SIZE, height=SIZE, alpha=False, is_data=data)
    image.colorspace_settings.name = 'Non-Color' if data else 'sRGB'
    image.generated_color = neutral
    node = nodes.new('ShaderNodeTexImage')
    node.image = image
    nodes.active = node
    return node


def save(node, directory, name):
    node.image.filepath_raw = str(directory/(name+'.png'))
    node.image.file_format = 'PNG'
    node.image.save()


def bake(target, source, directory):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 1
    mat = target.data.materials[0]
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    normal = texture(nodes, 'Normal', (.5, .5, 1, 1), True)
    activate(target)
    source.select_set(True)
    source.hide_render = False
    bpy.ops.object.bake(type='NORMAL', use_selected_to_active=True, cage_extrusion=.6,
        max_ray_distance=2, margin=8, use_clear=False)
    source.hide_render = True
    pixels = np.empty(SIZE*SIZE*4, np.float32)
    normal.image.pixels.foreach_get(pixels)
    rgba = pixels.reshape(-1, 4)
    # Opposite-hemisphere rays hit another part of a folded/fused print mesh.
    # Such hits cannot describe this surface; a neutral normal is safer.
    invalid = (~np.isfinite(rgba).all(1)) | (rgba[:, 2]<.5)
    rgba[invalid] = (.5, .5, 1, 1)
    normal.image.pixels.foreach_set(rgba.ravel())
    save(normal, directory, 'normal')
    colour = texture(nodes, 'Colour', (.23, .21, .17, 1))
    activate(target)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_selected_to_active=False,
                        margin=8, use_clear=False)
    save(colour, directory, 'colour')

    # AO is gentle, separate from albedo and limited to local crevices.
    surface = nodes.new('ShaderNodeVertexColor')
    surface.layer_name = 'Surface'
    separate = nodes.new('ShaderNodeSeparateColor')
    links.new(surface.outputs['Color'], separate.inputs['Color'])
    ao = nodes.new('ShaderNodeAmbientOcclusion')
    ao.inputs['Distance'].default_value = 2
    ao.samples = 8
    remap = nodes.new('ShaderNodeMath')
    remap.operation = 'MULTIPLY_ADD'
    remap.inputs[1].default_value = .25
    remap.inputs[2].default_value = .75
    links.new(ao.outputs['AO'], remap.inputs[0])
    combine = nodes.new('ShaderNodeCombineColor')
    links.new(remap.outputs[0], combine.inputs['Red'])
    links.new(separate.outputs['Green'], combine.inputs['Green'])
    links.new(separate.outputs['Blue'], combine.inputs['Blue'])
    emit = nodes.new('ShaderNodeEmission')
    links.new(combine.outputs[0], emit.inputs['Color'])
    output = nodes.get('Material Output')
    links.new(emit.outputs[0], output.inputs['Surface'])
    orm = texture(nodes, 'ORM', (1, .85, 0, 1), True)
    bpy.ops.object.bake(type='EMIT', use_selected_to_active=False, margin=8, use_clear=False)
    save(orm, directory, 'orm')
    links.new(shader.outputs[0], output.inputs['Surface'])
    links.new(colour.outputs['Color'], shader.inputs['Base Color'])
    normal_map = nodes.new('ShaderNodeNormalMap')
    links.new(normal.outputs['Color'], normal_map.inputs['Color'])
    links.new(normal_map.outputs[0], shader.inputs['Normal'])
    packed = nodes.new('ShaderNodeSeparateColor')
    links.new(orm.outputs['Color'], packed.inputs['Color'])
    links.new(packed.outputs['Green'], shader.inputs['Roughness'])
    links.new(packed.outputs['Blue'], shader.inputs['Metallic'])
    group = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    group.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    occlusion = nodes.new('ShaderNodeGroup')
    occlusion.node_tree = group
    links.new(packed.outputs['Red'], occlusion.inputs['Occlusion'])


def validate_maps(target):
    """Check actual triangle interiors, not empty pixels outside UV islands."""
    mesh = target.data
    mesh.calc_loop_triangles()
    uv = mesh.uv_layers.active.data
    centres = np.array([np.mean([uv[i].uv[:] for i in tri.loops], axis=0)
                        for tri in mesh.loop_triangles])
    xy = np.clip((centres*SIZE).astype(int), 0, SIZE-1)
    pixels = np.empty(SIZE*SIZE*4, np.float32)
    bpy.data.images['Colour'].pixels.foreach_get(pixels)
    colours = pixels.reshape(SIZE, SIZE, 4)[xy[:, 1], xy[:, 0], :3]
    black = int((colours.max(1)<.003).sum())
    bpy.data.images['Normal'].pixels.foreach_get(pixels)
    normals = pixels.reshape(SIZE, SIZE, 4)[xy[:, 1], xy[:, 0], :3]
    invalid = int(((normals[:, 2]<.5)|(~np.isfinite(normals).all(1))).sum())
    if black or invalid:
        raise RuntimeError(f'Baked texture defects: {black} black, {invalid} flipped normals')
    return {'blackTriangleCentres': black, 'invalidNormalCentres': invalid,
            'trianglesChecked': len(centres), 'textureSize': SIZE}
