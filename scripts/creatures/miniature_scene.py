"""Shared Blender I/O, normalization, and review cameras for static miniatures."""
import math
from pathlib import Path
import bpy
from mathutils import Vector, Matrix


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def import_glb(path, replace=True):
    if replace:
        clear()
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.context.scene.objects if obj not in before and obj.type == 'MESH']
    matrices = {obj: obj.matrix_world.copy() for obj in meshes}
    for obj in meshes:
        obj.parent = None
        obj.matrix_world = matrices[obj]
    bpy.context.view_layer.update()
    return meshes


def points(meshes):
    bpy.context.view_layer.update()
    return [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]


def normalize(meshes, height=1.4):
    import numpy as np
    values = np.array([tuple(p) for p in points(meshes)])
    low, high = values.min(axis=0), values.max(axis=0)
    feet = values[values[:, 2] < low[2] + (high[2] - low[2]) * .06]
    centre = Vector((*np.median(feet[:, :2], axis=0), low[2]))
    scale = height / (high[2] - low[2])
    return Matrix.Translation((0, 0, .06)) @ Matrix.Scale(scale, 4) @ Matrix.Translation(-centre)


def standing_transform(calibration, reference_diameter):
    """One reviewed source-space datum for every geometry role; no bounds fit."""
    diameter, origin = calibration['sourceDiameter'], calibration['sourceOrigin']
    rotation = calibration['rotation']
    if not all(math.isfinite(v) for v in [diameter, reference_diameter, rotation, *origin]) or diameter <= 0 or reference_diameter <= 0 or len(origin) != 3:
        raise ValueError('Invalid source standing circle')
    return (Matrix.Rotation(math.radians(rotation), 4, 'Z') @
            Matrix.Scale(reference_diameter / diameter, 4) @ Matrix.Translation(-Vector(origin)))


def paint(name, rgb, roughness=.8, metal=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    mat.use_backface_culling = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metal
    if emission:
        shader.inputs['Emission Color'].default_value = (*rgb, 1)
        shader.inputs['Emission Strength'].default_value = emission
    return mat


def material_profile(meshes, profile='native'):
    if profile not in {'native', 'dielectric'}:
        raise ValueError('Unknown miniature material profile: '+profile)
    if profile == 'native':
        return
    for obj in meshes:
        for material in obj.data.materials:
            shader = material.node_tree.nodes.get('Principled BSDF') if material and material.use_nodes else None
            if shader:
                for link in list(shader.inputs['Metallic'].links):
                    material.node_tree.links.remove(link)
                shader.inputs['Metallic'].default_value = 0


def base():
    rim = paint('Charcoal miniature rim', (.035, .04, .045))
    top = paint('Slate miniature top', (.115, .12, .105), .95)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=.45, depth=.05, location=(0, 0, .025))
    obj = bpy.context.object
    obj.name = 'Miniature base rim'
    obj.data.materials.append(rim)
    bevel = obj.modifiers.new('Rounded base edge', 'BEVEL')
    bevel.width, bevel.segments = .005, 2
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=.428, depth=.008, location=(0, 0, .054))
    bpy.context.object.name = 'Miniature stone top'
    bpy.context.object.data.materials.append(top)


def export_glb(path, shadow=False):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
        export_animations=False, export_cameras=False, export_lights=False,
        export_materials='NONE' if shadow else 'EXPORT', export_yup=True, export_texcoords=not shadow)


def render(directory, views=None, resolution=800):
    scene = bpy.context.scene
    for obj in list(scene.objects):
        if obj.type in {'CAMERA', 'LIGHT'}:
            bpy.data.objects.remove(obj, do_unlink=True)
    scene.render.engine = 'CYCLES'
    scene.cycles.device, scene.cycles.samples = 'CPU', 24
    scene.cycles.use_denoising = True
    scene.render.threads_mode, scene.render.threads = 'FIXED', 8
    scene.render.resolution_x = scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.65, .7, .8, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .35
    scene.view_settings.view_transform = 'AgX'
    for name, position, power, size in [
        ('Soft key', (-2, -3, 4), 320, 3), ('Fill', (3, -1, 2), 170, 3),
        ('Rim', (1, 3, 3), 240, 2),
    ]:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.shape, data.size = power, 'DISK', size
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = position
        obj.rotation_euler = (Vector((0, 0, .5)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    data = bpy.data.cameras.new('Review camera')
    camera = bpy.data.objects.new('Review camera', data)
    bpy.context.collection.objects.link(camera)
    scene.camera, data.type = camera, 'ORTHO'
    verts = points([obj for obj in scene.objects if obj.type == 'MESH'])
    centre = (Vector([min(p[i] for p in verts) for i in range(3)]) +
              Vector([max(p[i] for p in verts) for i in range(3)])) / 2
    for name, yaw, elevation in views or [('preview', 254, 25), ('back', 74, 25), ('top', 254, 78)]:
        yaw, elevation = math.radians(yaw), math.radians(elevation)
        camera.location = centre + Vector((math.sin(yaw) * math.cos(elevation),
            math.cos(yaw) * math.cos(elevation), math.sin(elevation))) * 4
        camera.rotation_euler = (centre - camera.location).to_track_quat('-Z', 'Y').to_euler()
        rotation = camera.rotation_euler.to_matrix().transposed()
        projected = [rotation @ (p - centre) for p in verts]
        data.ortho_scale = max(max(p.x for p in projected) - min(p.x for p in projected),
            max(p.y for p in projected) - min(p.y for p in projected)) * 1.14
        scene.render.filepath = str(Path(directory) / f'{name}.png')
        bpy.ops.render.render(write_still=True)
