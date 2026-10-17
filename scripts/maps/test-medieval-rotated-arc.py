"""Run with Blender: rotating an arch must rotate its painted grain with it."""
import copy
import json
from pathlib import Path
import sys
import numpy as np
import bpy
from mathutils import Matrix, Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
from medieval_structure import paint

base = json.loads((Path(__file__).parent/'medieval-recipes/MT1-057.json').read_text())
for axis in ['arc-xz', 'arc-yz']:
    colours = []
    for angle in [0, 37]:
        local = [(-3, 0, 2), (-1, 0, 3), (1, 0, 3), (3, 0, 2)]
        if axis == 'arc-yz':
            local = [(y, x, z) for x, y, z in local]
        rotation = Matrix.Rotation(np.deg2rad(angle), 3, 'Z')
        mesh = bpy.data.meshes.new('Arc')
        mesh.from_pydata([rotation@Vector(v) for v in local], [], [(0, 1, 2), (0, 2, 3)])
        mesh.update()
        obj = bpy.data.objects.new('Arc', mesh)
        bpy.context.collection.objects.link(obj)
        recipe = copy.deepcopy(base)
        recipe['materials']['woodParts'] = [{
            'name': 'test arch', 'axis': axis, 'minMM': [-4, -4, 0], 'maxMM': [4, 4, 4],
            'centerMM': [0, 0, 0], 'rotationZDeg': angle,
            'centerXZMM': [0, -1], 'centerYZMM': [0, -1], 'radiusMM': 4,
        }]
        paint(obj, recipe)
        values = np.empty(len(mesh.vertices)*4, np.float32)
        mesh.color_attributes['Paint'].data.foreach_get('color', values)
        colours.append(values)
        bpy.data.objects.remove(obj, do_unlink=True)
    np.testing.assert_allclose(colours[0], colours[1], rtol=2e-5, atol=2e-6)
print('ROTATED_ARC_GRAIN_CONFIRMED', flush=True)
