"""Keep measured small sculpted details intact during whole-tile reduction."""
import hashlib
import json
import math


def face_key(mesh, face):
    points = [tuple(mesh.vertices[i].co) for i in face.vertices]
    assert len(points) == 3, 'Triangulated source detail required'
    start = min(range(3), key=lambda i: points[i])
    return tuple(points[start:] + points[:start])


def pin_details(target, regions, base_group=None):
    mesh = target.data
    # Cutting the native mount may turn intersected STL triangles into quads.
    # Pin their deterministic triangulation before recording triangle identities.
    if any(len(face.vertices) != 3 for face in mesh.polygons):
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.triangulate(bm, faces=[face for face in bm.faces if len(face.verts) != 3])
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
    inside = set()
    counts = []
    for region in regions:
        lo, hi = region['minMM'], region['maxMM']
        if (len(lo) != 3 or len(hi) != 3 or
                not all(math.isfinite(a) and math.isfinite(c) and a < c for a, c in zip(lo, hi))):
            raise ValueError('Finite positive measured geometry detail bounds required')
        selected = {v.index for v in mesh.vertices
                    if all(a <= c <= h for c, a, h in zip(v.co, lo, hi))}
        if not selected:
            raise ValueError('Measured geometry detail contains no source vertices')
        inside |= selected
        counts.append(dict(name=region['name'], vertices=len(selected)))
    faces = [face for face in mesh.polygons if any(i in inside for i in face.vertices)]
    protected = {i for face in faces for i in face.vertices}
    before = {face_key(mesh, face) for face in faces}
    group = target.vertex_groups.get(base_group) if base_group else None
    if base_group and group is None:
        raise ValueError('Existing collapse restrictions missing')
    if group is None:
        group = target.vertex_groups.new(name='Measured detail collapse')
        eligible = [v.index for v in mesh.vertices if v.index not in protected]
        group.add(eligible, 1, 'REPLACE')
    else:
        group.remove(list(protected))
    review = dict(regions=counts, protectedVertices=len(protected), protectedTriangles=len(before))
    return group.name, before, review


def verify_details(target, before, review):
    after = {face_key(target.data, face) for face in target.data.polygons}
    missing = before - after
    if missing:
        raise ValueError('Simplification changed measured geometry detail triangles')
    return {**review, 'preservedTriangles': len(before),
            'nativeTrianglesSHA256': hashlib.sha256(json.dumps(sorted(before)).encode()).hexdigest()}
