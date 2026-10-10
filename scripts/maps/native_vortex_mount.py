"""Fit only the outer native vortex mount, retaining its deep inner funnel."""
import bpy
import bmesh
from tile_mesh import activate


def fit_native_vortex_mount(target, datum):
    if not 5.1 < datum < 5.2:
        raise ValueError('Measured LC-100 mounting datum required')
    high = max(v.co.z for v in target.data.vertices) + 1
    rings = [(-10.3, 13.3), (1.15, 13.3),
             (datum, 17.15), (datum, 64), (high, 64)]
    vertices = [(x*h, y*h, z) for z, h in rings
                for x, y in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
    faces = [(3, 2, 1, 0), (16, 17, 18, 19)]
    for ring in range(4):
        for side in range(4):
            a = ring*4+side
            b = ring*4+(side+1)%4
            faces.append((a, b, b+4, a+4))
    mesh = bpy.data.meshes.new('Reviewed vortex outer mounting envelope')
    mesh.from_pydata(vertices, [], faces)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    envelope = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.scene.collection.objects.link(envelope)
    activate(target)
    modifier = target.modifiers.new('Fit native vortex outside only', 'BOOLEAN')
    modifier.operation = 'INTERSECT'
    modifier.solver = 'EXACT'
    modifier.object = envelope
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(envelope, do_unlink=True)
    bpy.data.meshes.remove(mesh)
    if not target.data.polygons:
        raise ValueError('Native vortex intersection removed its sculpt')
