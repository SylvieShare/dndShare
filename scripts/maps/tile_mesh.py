"""Shared STL mounting-base removal and shading for offline asset preparation."""
import math
import bmesh
import bpy


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def crop(obj, height):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    if min(v.co.z for v in bm.verts) < height-.0001:
        bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
            plane_co=(0, 0, height), plane_no=(0, 0, 1), dist=1e-6, clear_inner=True)
        edges = [e for e in bm.edges if e.is_boundary and
                 all(abs(v.co.z-height)<1e-4 for v in e.verts)]
        if not edges:
            raise RuntimeError('No mounting-base cut boundary')
        faces = bmesh.ops.holes_fill(bm, edges=edges, sides=0)['faces']
        if not faces:
            raise RuntimeError('Cannot cap mounting base')
        bmesh.ops.triangulate(bm, faces=faces)
    for v in bm.verts:
        v.co.z -= height
        if abs(v.co.z)<1e-4:
            v.co.z = 0
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def shade(obj):
    for face in obj.data.polygons:
        face.use_smooth = not all(abs(obj.data.vertices[i].co.z)<1e-5 for i in face.vertices)
    obj.data.set_sharp_from_angle(angle=math.radians(55))
