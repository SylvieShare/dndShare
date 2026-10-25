"""Actual Blender pigment/ORM must match the independent JS sampler on an arbitrary measured arc plane."""
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


import numpy as np
from medieval_structure import source_reference_coordinates
angle,tilt=.31,.14
U=[np.cos(angle),np.sin(angle),0]
V=[np.sin(angle)*np.sin(tilt),-np.cos(angle)*np.sin(tilt),np.cos(tilt)]
N=[np.sin(angle)*np.cos(tilt),-np.cos(angle)*np.cos(tilt),-np.sin(tilt)]
centre=[7,-4,11]
part=dict(name='measured tilted arc',minMM=[-100,-100,-100],maxMM=[100,100,100],
          axis='arc-plane',physicalPigment=True,centerMM=centre,arcUAxis=U,arcVAxis=V,
          radiusMM=5.5,roughness=.91,darkRGB=[.31,.17,.06],lightRGB=[.62,.38,.18])
samples=[]
for a in [.15,.65,1.4,2.4,2.95]:
 for depth in [-3,0,4]:
  x,z=5.2*np.cos(a),5.2*np.sin(a)
  samples.append(([centre[i]+U[i]*x+V[i]*z+N[i]*depth for i in range(3)],N))
base = json.loads((ROOT/'scripts/maps/medieval-recipes/MT1-064.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
payload = []
actual = []
for axis in ['arc-plane']:
    field=copy.deepcopy(part)
    points=samples
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
assert len(actual) == len(expected) == 15
for got, want in zip(actual, expected):
    assert max(abs(a-b) for a, b in zip(got['colour'], want['colour'])) < 2e-6, (got, want)
    assert abs(got['roughness']-want['roughness']) < 1e-6, (got, want)
    assert abs(got['metallic']-want['metallic']) < 1e-6, (got, want)
print('MEDIEVAL_ARC_PLANE_PYTHON_JS_CONFIRMED', len(actual))

refs=[dict(rotationZDeg=270,mirrorY=True),
      dict(nativeToReferenceMatrix=[U,V,N],nativeToReferenceOffsetMM=[1.2,-3.4,.5]),
      dict(nativeToReferenceMatrix=[U,V,[-v for v in N]],nativeToReferenceOffsetMM=[-1,2,3])]
points=np.asarray([p for p,_ in samples])
expected=[source_reference_coordinates(points,ref).tolist()for ref in refs]
code="""
import fs from 'node:fs';
import{compileSourceReferenceTransform}from'./scripts/maps/medieval_source_reference.mjs';
const{refs,points}=JSON.parse(fs.readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(refs.map(ref=>{const apply=compileSourceReferenceTransform(ref);return points.map(p=>apply(p));})));
"""
result=subprocess.run(['node','--input-type=module','-e',code],input=json.dumps(dict(refs=refs,points=points.tolist())),text=True,capture_output=True,cwd=ROOT,check=True)
assert np.max(abs(np.asarray(expected)-np.asarray(json.loads(result.stdout))))<1e-10
for matrix in [[[2,0,0],[0,1,0],[0,0,1]],[[1,0,0],[1,0,0],[0,0,1]]]:
 try:source_reference_coordinates(points,dict(nativeToReferenceMatrix=matrix,nativeToReferenceOffsetMM=[0,0,0]))
 except ValueError:pass
 else:raise AssertionError('Invalid source transform accepted')
print('MEDIEVAL_SOURCE_COORDINATES_PYTHON_JS_CONFIRMED',len(refs)*len(points))
