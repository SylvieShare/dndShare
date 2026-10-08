"""Regression: reversed legacy floor is measured, reversed new floor is rejected."""
import importlib.util
import tempfile
from pathlib import Path

import bpy

spec = importlib.util.spec_from_file_location(
    'placement', Path(__file__).with_name('check-cave-placement.py'))
placement = importlib.util.module_from_spec(spec)
spec.loader.exec_module(placement)
model = {
    'width': 1, 'height': 1, 'maxHeight': 1, 'placementOffset': [0, 0],
    'placementPoints': [{'x': .5, 'y': .5, 'elevation': .4}],
}
with tempfile.TemporaryDirectory(prefix='dndshare-cave-placement-') as tmp:
    files = []
    for reverse in [False, True]:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        mesh = bpy.data.meshes.new('Floor')
        face = [3, 2, 1, 0] if reverse else [0, 1, 2, 3]
        mesh.from_pydata([(-.5, -.5, .4), (.5, -.5, .4),
                         (.5, .5, .4), (-.5, .5, .4)], [], [face])
        mesh.update()
        bpy.context.scene.collection.objects.link(bpy.data.objects.new('Floor', mesh))
        file = Path(tmp) / ('reversed.glb' if reverse else 'up.glb')
        bpy.ops.export_scene.gltf(filepath=str(file), export_format='GLB', export_yup=True)
        files.append(file)
    values, normals = placement.heights(files[1], model, require_up=False)
    assert abs(values[0] - .4) < .00001 and normals[0] < 0
    values, normals = placement.heights(files[0], model)
    assert abs(values[0] - .4) < .00001 and normals[0] > 0
    try:
        placement.heights(files[1], model)
    except ValueError as error:
        assert 'inverted normals' in str(error)
    else:
        raise AssertionError('Reversed new floor incorrectly accepted')
print('CAVE_PLACEMENT_NORMALS_PASSED', flush=True)
