"""Measure distance to a complete bare sculpt for overlapping added parts."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--report', type=Path, required=True)
parser.add_argument('--reference-spec')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
report = json.loads(args.report.read_text())
spec = json.loads(args.reference_spec) if args.reference_spec else report['materialSpec']['proximityReference']
row = next(r for r in json.loads((ROOT/'models/collections/manifest.json').read_text())
           if r['collection'] == 'toxic-sewer' and r['code'] == spec['code'])
source_path = ROOT/'models'/row['sourcePath']
if hashlib.sha256(source_path.read_bytes()).hexdigest() != row['sourceSHA256']:
    raise RuntimeError('Bare source changed')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.stl_import(filepath=str(source_path))
source = bpy.context.object
angle = math.radians(spec.get('rotationZDegrees', 0))
cosine, sine = math.cos(angle), math.sin(angle)
for vertex in source.data.vertices:
    x, y = vertex.co.x, vertex.co.y
    vertex.co.x, vertex.co.y = cosine*x-sine*y, sine*x+cosine*y
    vertex.co.z -= row['cutHeight']
if spec.get('minimumSurfaceZMM') is not None:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from sewer_crop import crop
    crop(source, spec['minimumSurfaceZMM'])
    for vertex in source.data.vertices:
        vertex.co.z += spec['minimumSurfaceZMM']
source.data.update()
bpy.context.view_layer.update()
if spec.get('minimumSurfaceZMM') is not None:
    # Caps close the scratch mesh but are not part of the original bank.
    # Including their artificial plane can incorrectly reject water waves.
    minimum = spec['minimumSurfaceZMM']
    faces = [list(face.vertices) for face in source.data.polygons
             if not all(abs(source.data.vertices[i].co.z-minimum) < 1e-4 for i in face.vertices)]
    tree = BVHTree.FromPolygons([v.co for v in source.data.vertices], faces)
else:
    tree = BVHTree.FromObject(source, bpy.context.evaluated_depsgraph_get())
low, high = spec['boundsMM']
step = spec['stepMM']
size = [int(np.ceil((high[i]-low[i])/step))+1 for i in range(3)]
values = np.empty(np.prod(size), dtype='<f4')
index = 0
for z in range(size[2]):
    for y in range(size[1]):
        for x in range(size[0]):
            point = Vector((low[0]+x*step, low[1]+y*step, low[2]+z*step))
            values[index] = tree.find_nearest(point)[3]
            index += 1
directory = ROOT/'models/collections/toxic-sewer/references'
directory.mkdir(exist_ok=True)
binary = directory/(spec['code']+'-proximity.f32')
binary.write_bytes(values.tobytes())
descriptor = {**spec, 'cutCapsExcluded': True, 'low': low, 'size': size, 'sourceSHA256': row['sourceSHA256'],
              'binary': binary.name, 'valuesSHA256': hashlib.sha256(values.tobytes()).hexdigest()}
(directory/(spec['code']+'-proximity.json')).write_text(json.dumps(descriptor,indent=2)+'\n')
print('TOXIC_SEWER_PROXIMITY', spec['code'], size, len(values), flush=True)
