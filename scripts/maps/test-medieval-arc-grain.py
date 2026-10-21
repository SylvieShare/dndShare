"""Compare actual Blender Paint attributes with the packed-GLB arc pigment."""
import copy
import json
from pathlib import Path
import subprocess
import sys

import bpy
import numpy as np

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))
from medieval_structure import paint

recipe = json.loads((SCRIPTS / 'medieval-recipes/MT1-090.json').read_text())
node_script = (
    'import fs from "node:fs";'
    'import {structureWoodPigment} from ' +
    json.dumps((SCRIPTS / 'medieval_structure_domains.mjs').as_uri()) + ';'
    'const {points,settings}=JSON.parse(fs.readFileSync(0,"utf8"));'
    'console.log(JSON.stringify(points.map(p=>structureWoodPigment(p,[0,0,1],settings))));'
)
bpy.ops.wm.read_factory_settings(use_empty=True)
for axis in ['arc-xz', 'arc-yz']:
    part = dict(name='Measured test arc', minMM=[-100]*3, maxMM=[100]*3,
                axis=axis, physicalPigment=True, radiusMM=21.5, roughness=.9,
                darkRGB=[.3, .15, .05], lightRGB=[.55, .32, .12])
    part['centerXZMM' if axis == 'arc-xz' else 'centerYZMM'] = [3., 52.]
    points = []
    for angle, radius in [(1.1, 18.5), (1.4, 21.), (1.8, 24.)]:
        lateral, height = 3+radius*np.cos(angle), 52+radius*np.sin(angle)
        points.append((lateral, 2, height) if axis == 'arc-xz' else (2, lateral, height))
    mesh = bpy.data.meshes.new(axis)
    mesh.from_pydata(points, [], [(0, 1, 2)])
    mesh.update()
    obj = bpy.data.objects.new(axis, mesh)
    bpy.context.collection.objects.link(obj)
    sample = copy.deepcopy(recipe)
    settings = sample['materials']
    for key in ['stoneParts', 'surfaceParts', 'fabricParts', 'produceParts', 'ironParts', 'hardware']:
        settings[key] = []
    settings['woodParts'] = [part]
    payload = json.dumps(dict(points=[list(v.co) for v in mesh.vertices], settings=settings))
    actual_node = subprocess.run(['node', '--input-type=module', '-e', node_script],
                                 input=payload, text=True, capture_output=True, check=True)
    expected = np.array(json.loads(actual_node.stdout))
    expected = np.where(expected <= .04045, expected/12.92, ((expected+.055)/1.055)**2.4)
    paint(obj, sample)
    values = np.empty(len(points)*4, np.float32)
    mesh.color_attributes['Paint'].data.foreach_get('color', values)
    np.testing.assert_allclose(values.reshape(-1, 4)[:, :3], expected, atol=2e-5, rtol=2e-5)
print('BLENDER_NODE_ARC_PIGMENT_PARITY_PASS', flush=True)
