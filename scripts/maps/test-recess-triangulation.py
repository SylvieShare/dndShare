"""Run with Blender --background --python-exit-code 1 --python this_file."""
import sys
from pathlib import Path
import bmesh

sys.path.insert(0, str(Path(__file__).parent))
from recess_triangulation import triangulate_recess


def fixture(points, chord, area):
    bm = bmesh.new()
    vertices = [bm.verts.new((x, y, 0)) for x, y in points]
    face = bm.faces.new(vertices)
    face.material_index = 2
    bm.normal_update()
    normal = face.normal.copy()
    a, c = [vertices[i] for i in chord]
    e = bm.verts.new((.5, .5, 1))
    f = bm.verts.new((1.5, 1.5, -1))
    bm.faces.new((a, c, e))
    bm.faces.new((c, a, f))
    before = [tuple(v.co) for v in bm.verts]
    original_edge = bm.edges.get((a, c))
    assert len(original_edge.link_faces) == 2
    review = triangulate_recess(bm)
    assert review['constrainedFaces'] == 1
    assert [tuple(v.co) for v in list(bm.verts)[:len(before)]] == before
    assert all(len(face.verts) == 3 for face in bm.faces)
    assert len(original_edge.link_faces) == 2
    assert max(len(edge.link_faces) for edge in bm.edges) <= 2
    assert all(f.normal.dot(normal) > .999 for f in bm.faces if f.material_index == 2)
    assert abs(sum(f.calc_area() for f in bm.faces if f.material_index == 2)-area) < 1e-6
    bm.free()


fixture([(0, 0), (2, 0), (2, 1), (0, 1)], (0, 2), 2)
fixture([(0, 1), (2, 1), (2, 0), (0, 0)], (0, 2), 2)
fixture([(0, 0), (2, 0), (2, 1), (1, 1), (1, 2), (0, 2)], (0, 3), 3)


def unconstrained(points):
    meshes = [bmesh.new(), bmesh.new()]
    for bm in meshes:
        vertices = [bm.verts.new((x, y, 0)) for x, y in points]
        face = bm.faces.new(vertices)
        face.material_index = 3
        bm.normal_update()
    bmesh.ops.triangulate(meshes[0], faces=list(meshes[0].faces), ngon_method='EAR_CLIP')
    review = triangulate_recess(meshes[1])
    assert review['constrainedFaces'] == 0 and review['steinerVertices'] == 0
    def triangles(bm):
        return {frozenset(tuple(v.co) for v in f.verts) for f in bm.faces}
    assert triangles(meshes[0]) == triangles(meshes[1]), 'Ear clipping diagonals changed'
    assert all(f.material_index == 3 for f in meshes[1].faces)
    assert sum(e.is_boundary for e in meshes[1].edges) == len(points)
    reference_normal = next(iter(meshes[0].faces)).normal.z
    assert all(f.normal.z * reference_normal > .999 for f in meshes[1].faces)
    for bm in meshes:
        bm.free()


unconstrained([(0, 0), (2, 0), (2, 1), (0, 1)])
unconstrained([(0, 1), (2, 1), (2, 0), (0, 0)])
unconstrained([(0, 0), (2, 0), (2, 1), (1, 1), (1, 2), (0, 2)])
print('RECESS_TRIANGULATION_TESTS_PASS', flush=True)
