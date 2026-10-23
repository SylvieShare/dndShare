"""Deterministic, paintable mesh primitives for miniature equipment."""
import math
import bpy
from mathutils import Vector, Matrix
from miniature_scene import paint


class Geometry:
    def __init__(self, lod=False):
        self.lod = lod
        self.sides = 10 if lod else 18
        self.objects = []
        self.materials = {}

    def material(self, name, rgb, roughness=.8, metal=0, emission=0):
        if name not in self.materials:
            self.materials[name] = paint(name, rgb, roughness, metal, emission)
        return self.materials[name]

    def finish(self, name, material, smooth=False):
        obj = bpy.context.object
        obj.name = name
        obj.data.materials.append(material)
        if smooth:
            for face in obj.data.polygons:
                face.use_smooth = True
        self.objects.append(obj)
        bpy.context.view_layer.update()
        return obj

    def sphere(self, name, centre, scale, material, axis=None):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=self.sides, ring_count=8 if self.lod else 12, location=centre)
        obj = self.finish(name, material, True)
        obj.scale = scale
        if axis is not None:
            obj.rotation_euler = Vector(axis).to_track_quat('Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        return obj

    def box(self, name, centre, size, material, rotation=None, bevel=.004):
        bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
        obj = self.finish(name, material)
        obj.scale = size
        if rotation is not None:
            obj.rotation_euler = rotation.to_euler()
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel and not self.lod:
            mod = obj.modifiers.new('Painted edge bevel', 'BEVEL')
            mod.width, mod.segments = bevel, 1
            bpy.ops.object.modifier_apply(modifier=mod.name)
        return obj

    def rod(self, name, start, end, radius, material, tip=None):
        start, end = Vector(start), Vector(end)
        delta = end - start
        bpy.ops.mesh.primitive_cone_add(vertices=self.sides, radius1=radius,
            radius2=radius if tip is None else tip, depth=delta.length, location=(start + end) / 2)
        obj = self.finish(name, material, True)
        obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        return obj

    def ring(self, name, centre, axis, radius, thickness, material):
        bpy.ops.mesh.primitive_torus_add(major_segments=self.sides,
            minor_segments=4 if self.lod else 6, major_radius=radius,
            minor_radius=thickness, location=centre)
        obj = self.finish(name, material, True)
        obj.rotation_euler = Vector(axis).to_track_quat('Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        return obj

    def tube(self, name, points, radius, material):
        data = bpy.data.curves.new(name, 'CURVE')
        data.dimensions = '3D'
        data.resolution_u = 2
        data.bevel_depth, data.bevel_resolution = radius, 1 if self.lod else 2
        spline = data.splines.new('POLY')
        spline.points.add(len(points) - 1)
        for point, value in zip(spline.points, points):
            point.co = (*Vector(value), 1)
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')
        return self.finish(name, material, True)

    def mesh(self, name, vertices, faces, material, thickness=0):
        data = bpy.data.meshes.new(name)
        data.from_pydata(vertices, [], faces)
        data.update()
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        self.finish(name, material)
        if thickness:
            mod = obj.modifiers.new('Physical cloth thickness', 'SOLIDIFY')
            mod.thickness = thickness
            bpy.ops.object.modifier_apply(modifier=mod.name)
        return obj

    def gemstone(self, name, centre, radius, material):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1 if self.lod else 2,
            radius=radius, location=centre)
        return self.finish(name, material)

    def fur(self, name, centre, axis, radius, material, seed=0):
        import random
        rng = random.Random(seed)
        axis = Vector(axis).normalized()
        first = axis.cross(Vector((1, 0, 0)))
        if first.length < .1:
            first = axis.cross(Vector((0, 1, 0)))
        first.normalize()
        second = axis.cross(first).normalized()
        self.ring(name + ' underfur', centre, axis, radius, .013, material)
        count = 12 if self.lod else 22
        for i in range(count):
            angle = i * math.tau / count
            radial = first * math.cos(angle) + second * math.sin(angle)
            point = Vector(centre) + radial * radius
            flow = (radial * .6 - axis * .8 + first * rng.uniform(-.2, .2)).normalized()
            self.rod(f'{name} tuft {i}', point - flow * .012,
                point + flow * rng.uniform(.025, .04), .017, material, tip=.001)


def frame(front):
    front = Vector(front).normalized()
    up = Vector((0, 0, 1))
    side = up.cross(front).normalized()
    return Matrix((side, -front, up)).transposed()
