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
print('RECESS_TRIANGULATION_TESTS_PASS', flush=True)
