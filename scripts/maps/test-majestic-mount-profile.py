"""Mount containment checks the bridges between pins, not only pin extrema."""
import importlib.util
from pathlib import Path
from mathutils import Vector

spec = importlib.util.spec_from_file_location('profile', Path(__file__).with_name('validate-majestic-mount-profile.py'))
profile = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profile)

vertices, faces = [], []
for cy in [-3,0,3]:
    start = len(vertices)
    vertices += [Vector((x,cy+y,z)) for z in [0,2] for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    faces += [tuple(start+i for i in f) for f in [(0,1,2),(0,2,3),(4,6,5),(4,7,6),(0,4,5),(0,5,1),(1,5,6),(1,6,2),(2,6,7),(2,7,3),(3,7,4),(3,4,0)]]
settings = {'depthMM':2,'pinCentresMM':[[0,-3],[0,0],[0,3]],'sectionsMM':[[0,1.1],[2,1.1]]}
saved = [tuple(v) for v in vertices]
error, tested = profile.enclosing_error(vertices, faces, settings)
assert error == 0 and tested > 0
# A small protrusion remains below mount depth and must be rejected.
changed = vertices.copy()
changed[4] = Vector((1.3,-3,2))
assert profile.enclosing_error(changed, faces, settings)[0] > .19
# Bridges cross the Voronoi boundary halfway between pin centres.
start = len(vertices)
vertices += [Vector((x,y,1.5)) for x,y in [(-1,1.4),(1,1.4),(1,1.6),(-1,1.6)]]
faces += [(start,start+1,start+2),(start,start+2,start+3)]
assert profile.enclosing_error(vertices, faces, settings)[0] > .39
settings['sectionsMM'] = [[0,1.1],[1.4,1.1],[1.5,1.6],[2,1.6]]
assert profile.enclosing_error(vertices, faces, settings)[0] == 0
assert saved == [tuple(v) for v in vertices[:len(saved)]]
# Geometry above mount depth does not belong to the insertion envelope.
vertices += [Vector((10,10,3)),Vector((11,10,3)),Vector((10,11,3))]
faces += [tuple(range(len(vertices)-3,len(vertices)))]
assert profile.enclosing_error(vertices, faces, settings)[0] == 0
print('MAJESTIC_MOUNT_PROFILE_TEST_PASSED', 'protrusion and uncovered bridge rejected; complete mount accepted', flush=True)
