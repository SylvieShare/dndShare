"""Cap a sliced solid using all contours together, preserving nested openings."""
import bmesh
from mathutils.geometry import tessellate_polygon


def cap_section(bm, height):
    edges = [e for e in bm.edges if e.is_boundary and
             all(abs(v.co.z-height) < 1e-4 for v in e.verts)]
    if not edges:
        raise RuntimeError('No mounting-base cut boundary')
    adjacency = {}
    for edge in edges:
        for vertex in edge.verts:
            adjacency.setdefault(vertex, []).append(edge)
    if any(len(connected) != 2 for connected in adjacency.values()):
        raise RuntimeError('Ambiguous cut contours; inspect source before capping')
    remaining = set(edges)
    loops = []
    while remaining:
        first = next(iter(remaining)).verts[0]
        current = first
        loop = []
        while True:
            loop.append(current)
            edge = next((e for e in adjacency[current] if e in remaining), None)
            if edge is None:
                raise RuntimeError('Cut contour is not closed')
            remaining.remove(edge)
            current = edge.other_vert(current)
            if current == first:
                break
        if len(loop) < 3:
            raise RuntimeError('Degenerate cut contour')
        loops.append(loop)
    vertices = [v for loop in loops for v in loop]
    triangles = tessellate_polygon([[v.co.copy() for v in loop] for loop in loops])
    if not triangles:
        raise RuntimeError('Cannot tessellate cut contours')
    for indices in triangles:
        bm.faces.new([vertices[i] for i in indices])
    return len(loops), len(triangles)


def crop(obj, height):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    if min(v.co.z for v in bm.verts) < height-.0001:
        bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                              plane_co=(0, 0, height), plane_no=(0, 0, 1),
                              dist=1e-6, clear_inner=True)
        cap_section(bm, height)
    for vertex in bm.verts:
        vertex.co.z -= height
        if abs(vertex.co.z) < 1e-4:
            vertex.co.z = 0
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def clip_mount(obj, height):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                          plane_co=(0, 0, height), plane_no=(0, 0, 1),
                          dist=1e-6, clear_outer=True)
    cap_section(bm, height)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
