"""Keep broad stone lips distinct from fine terrace leaves before baking."""
from pathlib import Path
import sys
import tempfile
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from majestic_surface import grass_weights

bpy.ops.wm.read_factory_settings(use_empty=True)
mesh = bpy.data.meshes.new('Broad stone and isolated fine leaf')
mesh.from_pydata([(-1, 0, 26), (1, 0, 26), (1, 2, 26), (-1, 2, 26),
                  (4, 0, 26), (4.1, 0, 26), (4, .1, 26)], [],
                 [(0, 1, 2, 3), (4, 5, 6)])
mesh.update()
obj = bpy.data.objects.new('Terrace', mesh)
bpy.context.collection.objects.link(obj)
before = [tuple(v.co) for v in mesh.vertices]
recipe = {'raisedGrass': {'minMM': [-54, -54, 24], 'maxMM': [54, 54, 28],
                         'depthMM': 1.6, 'depthFadeMM': .5,
                         'normalMin': .4, 'normalFade': .25}}
survey = Path(__file__).resolve().parents[2]/'models/collections/majestic-highlands/survey'
with tempfile.TemporaryDirectory(prefix='.test-stepped-', dir=survey) as directory:
    np.save(Path(directory)/'top-surface.npy', np.full((211, 211, 4), 26, np.float32))
    code = Path(directory).name

    def cap_values():
        grass_weights(obj, recipe, code)
        values = np.empty(len(mesh.vertices)*4, np.float32)
        mesh.color_attributes['RaisedGrass'].data.foreach_get('color', values)
        mesh.color_attributes.remove(mesh.color_attributes['RaisedGrass'])
        return values.reshape(-1, 4)[:, 0]

    np.testing.assert_allclose(cap_values(), 1)
    recipe['raisedGrassStoneSurface'] = {'boundsMM': [[-54, -54, 24], [54, 54, 28]],
                                       'normalXMax': 1, 'minAreaMM2': .5,
                                       'growAngleRad': .2}
    actual = cap_values()
    np.testing.assert_allclose(actual[:4], 0)
    np.testing.assert_allclose(actual[4:], 1)
    recipe['raisedGrassStoneSurface']['boundsMM'][1][2] = 24.5
    np.testing.assert_allclose(cap_values(), 1)
    assert before == [tuple(v.co) for v in mesh.vertices]
    assert len(mesh.polygons) == 2
print('MAJESTIC_STEPPED_GRASS_TEST passed', flush=True)
