"""Boolean separation of a fused door, preserving the accepted surface UVs."""
import math
import bpy
import bmesh
from mathutils import Matrix, Vector


def apply_object(obj):
    world = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = Matrix.Scale(35, 4) @ world
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def cut_material(name, wood=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = .86 if wood else .9
    shader.inputs['Metallic'].default_value = 0
    coordinate = nodes.new('ShaderNodeTexCoord')
    scale = nodes.new('ShaderNodeVectorMath')
    scale.operation = 'MULTIPLY'
    scale.inputs[1].default_value = (.85, .85, .045) if wood else (.45, .45, .45)
    links.new(coordinate.outputs['Object'], scale.inputs[0])
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 1
    noise.inputs['Detail'].default_value = 2
    links.new(scale.outputs[0], noise.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    colors = [(.067, .043, .018, 1), (.135, .089, .044, 1)] if wood else [(.1, .125, .139, 1), (.16, .182, .193, 1)]
    for e, color in zip(ramp.color_ramp.elements, colors):
        e.color = color
    links.new(noise.outputs['Fac'], ramp.inputs[0])
    links.new(ramp.outputs[0], shader.inputs['Base Color'])
    return mat


def cutter_for(spec):
    c = spec['cut']
    r = c['radius']
    profile = [(-r, c['bottom']), (r, c['bottom'])] + [
        (r * math.cos(i * math.pi / c['segments']), c['spring'] + r * math.sin(i * math.pi / c['segments']))
        for i in range(c['segments'] + 1)]
    n = len(profile)
    vertices = [(x, y, z) for x in c['x'] for y, z in profile]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))] + [
        (i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    mesh = bpy.data.meshes.new('Measured arched cut')
    mesh.from_pydata(vertices, [], faces)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('Measured arched cut', mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def separate(body, spec):
    reference = body.copy()
    reference.data = body.data.copy()
    bpy.context.collection.objects.link(reference)
    reference.hide_render = True
    reference.hide_set(True)
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.002)
    bm.to_mesh(body.data)
    bm.free()
    cutter = cutter_for(spec)
    leaf = body.copy()
    leaf.data = body.data.copy()
    leaf.name = 'Open door leaf'
    bpy.context.collection.objects.link(leaf)
    for obj, operation, cap in [(body, 'DIFFERENCE', cut_material('Recovered stone reveal')),
                                (leaf, 'INTERSECT', cut_material('Recovered timber edge', True))]:
        obj.data.materials.append(cap)
        cutter.data.materials.clear()
        cutter.data.materials.append(cap)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        boolean = obj.modifiers.new('Separate frame and door', 'BOOLEAN')
        boolean.operation = operation
        boolean.solver = 'EXACT'
        boolean.use_self = True
        boolean.material_mode = 'TRANSFER'
        boolean.object = cutter
        bpy.ops.object.modifier_apply(modifier=boolean.name)
        normals = obj.modifiers.new('Retain original surface normals', 'DATA_TRANSFER')
        normals.object = reference
        normals.use_loop_data = True
        normals.data_types_loops = {'CUSTOM_NORMAL'}
        normals.loop_mapping = 'POLYINTERP_NEAREST'
        bpy.ops.object.modifier_apply(modifier=normals.name)
        values = [n.vector.copy() for n in obj.data.corner_normals]
        for face in obj.data.polygons:
            if obj.data.materials[face.material_index] == cap:
                face.use_smooth = False
                for index in face.loop_indices:
                    values[index] = face.normal
        obj.data.normals_split_custom_set(values)
        triangulate = obj.modifiers.new('Triangulate cut faces', 'TRIANGULATE')
        bpy.ops.object.modifier_apply(modifier=triangulate.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    bpy.data.objects.remove(reference, do_unlink=True)
    return leaf


def open_leaf(leaf, spec):
    pivot = Vector((*spec['hinge'], 0)) / 35
    rotation = Matrix.Rotation(math.radians(spec['angle']), 4, 'Z')
    leaf.rotation_mode = 'XYZ'
    leaf.rotation_euler.z = math.radians(spec['angle'])
    leaf.location = pivot - rotation @ pivot
