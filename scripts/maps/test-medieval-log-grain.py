"""Actual Blender pigment/ORM must match the independent JS sampler on both axes."""
import copy
import json
from pathlib import Path
import subprocess
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'scripts/maps'))
from medieval_structure import paint


def turn(vector):
    x, y, z = vector
    return [-y, x, z]


part = dict(
    name='synthetic wrapped timber', minMM=[-20,-20,0], maxMM=[20,20,30],
    axis='log-x', physicalPigment=True, capCentersMM=[[-10,0,15],[10,0,15]],
    grainRadiusMM=2, endRangesMM=[[-10.1,-9.8],[9.8,10.1]],
    roughness=.91, endRoughness=.67, darkRGB=[.3,.15,.05], lightRGB=[.55,.32,.12],
    endDarkRGB=[.37,.2,.08], endLightRGB=[.65,.4,.18],
)
samples = [
    ([-3.7,1.2,16.6], [0,.6,.8]), ([4,-1.4,16.2], [0,-.7,.6]),
    ([10,1.1,15.7], [1,0,0]), ([-10,-.9,13.9], [-1,0,0]),
    ([0,10,15], [0,1,0]),
]
base = json.loads((ROOT/'scripts/maps/medieval-recipes/MT1-064.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
payload = []
actual = []
for axis in ['log-x', 'log-y']:
    field = copy.deepcopy(part)
    points = samples
    if axis == 'log-y':
        field.update(axis=axis, capCentersMM=[turn(c) for c in part['capCentersMM']])
        points = [(turn(p), turn(n)) for p, n in samples]
    vertices, faces = [], []
    for position, normal in points:
        p, n = Vector(position), Vector(normal).normalized()
        helper = Vector((1,0,0)) if abs(n.x)<.8 else Vector((0,1,0))
        a = n.cross(helper).normalized()
        c = n.cross(a).normalized()
        start = len(vertices)
        vertices.extend([p, p+a*.03, p+c*.03])
        faces.append((start, start+1, start+2))
    mesh = bpy.data.meshes.new(axis)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(axis, mesh)
    bpy.context.collection.objects.link(obj)
    recipe = copy.deepcopy(base)
    settings = recipe['materials']
    for key in ['stoneParts','fabricParts','produceParts','surfaceParts','ironParts','hardware']:
        settings[key] = []
    settings['woodParts'] = [field]
    paint(obj, recipe)
    rows = []
    for i in range(0, len(vertices), 3):
        vertex = mesh.vertices[i]
        rows.append(dict(point=list(vertex.co), normal=list(vertex.normal)))
        actual.append(dict(
            colour=list(mesh.color_attributes['Paint'].data[i].color)[:3],
            roughness=mesh.color_attributes['Surface'].data[i].color[1],
            metallic=mesh.color_attributes['Surface'].data[i].color[2],
        ))
    payload.append(dict(settings=settings, rows=rows))

script = """
import fs from 'node:fs';
import {structureWoodPigment,structureMetal} from './scripts/maps/medieval_structure_domains.mjs';
const encode=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const result=JSON.parse(fs.readFileSync(0,'utf8')).flatMap(({settings,rows})=>rows.map(row=>({
  colour:structureWoodPigment(row.point,row.normal,settings).map(encode),
  ...structureMetal(row.point,settings),
})));
process.stdout.write(JSON.stringify(result));
"""
result = subprocess.run(
    ['node','--input-type=module','-e',script], input=json.dumps(payload),
    text=True, capture_output=True, cwd=ROOT, check=True,
)
expected = json.loads(result.stdout)
assert len(actual) == len(expected) == 10
for got, want in zip(actual, expected):
    assert max(abs(a-b) for a, b in zip(got['colour'], want['colour'])) < 2e-6, (got, want)
    assert abs(got['roughness']-want['roughness']) < 1e-6, (got, want)
    assert abs(got['metallic']-want['metallic']) < 1e-6, (got, want)
print('MEDIEVAL_LOG_GRAIN_PYTHON_JS_CONFIRMED', len(actual))
