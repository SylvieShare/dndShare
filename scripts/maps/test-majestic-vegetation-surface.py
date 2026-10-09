"""Blender regression: broad stone grows to fine facets, isolated leaves stay free."""
from pathlib import Path
import sys
import bpy
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
from majestic_vegetation_surface import stone_surface_mask

mesh = bpy.data.meshes.new('Cliff and leaf')
vertices = [(30,0,20),(30,0,22),(30,2,20),(30,2,22),
            (30,2.1,20),(30,2.1,22),
            (29,0,20),(29,0,20.2),(29,.2,20)]
faces = [(0,1,2),(1,3,2),(2,3,4),(3,5,4),(6,7,8)]
mesh.from_pydata(vertices,[],faces);mesh.update()
before_vertices = [tuple(v.co) for v in mesh.vertices]
before_faces = [tuple(f.vertices) for f in mesh.polygons]
settings = {'boundsMM':[[24,-1,19],[54,4,24]],'normalXMax':-.3,
            'minAreaMM2':.5,'growAngleRad':.2}
mask = stone_surface_mask(mesh,np.array(before_vertices),settings)
assert np.all(mask[:6] == 1), 'Fine coplanar stone facets must join the protection'
assert np.all(mask[6:] == 0), 'Small isolated leaf must remain vegetation'
assert before_vertices == [tuple(v.co) for v in mesh.vertices]
assert before_faces == [tuple(f.vertices) for f in mesh.polygons]
settings['boundsMM'] = [[40,-1,19],[54,4,24]]
assert not stone_surface_mask(mesh,np.array(before_vertices),settings).any()
print('MAJESTIC_VEGETATION_SURFACE_TEST_PASSED',flush=True)
