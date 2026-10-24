"""Blender: normalize reconstructed geometry for separate token bases."""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
import miniature_scene as scene

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
parser.add_argument('--footprint', type=float, default=.88, help='Native unit-token diameter')
parser.add_argument('--rotation', type=float, default=0)
parser.add_argument('--token-size', type=float, default=1, help='Nominal in-game footprint for the report')
parser.add_argument('--only', choices=['render', 'lod', 'shadow', 'source'])
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
folder = args.directory.resolve()
meshes = scene.import_glb(folder/'local-model/body-render.glb')
points = np.array([tuple(p) for p in scene.points(meshes)])
low, high = points.min(axis=0), points.max(axis=0)
centre = Vector(((low[0]+high[0])/2, (low[1]+high[1])/2, low[2]))
radius = np.max(np.linalg.norm(points[:, :2]-np.array(centre)[:2], axis=1))
scale = args.footprint/(2*radius)
transform = Matrix.Rotation(math.radians(args.rotation), 4, 'Z') @ Matrix.Scale(scale, 4) @ Matrix.Translation(-centre)
for role in ['render', 'lod', 'shadow', 'source']:
    if args.only and role != args.only:
        continue
    meshes = scene.import_glb(folder/f'local-model/body-{role}.glb')
    for obj in meshes:
        obj.matrix_world = transform @ obj.matrix_world
        for face in obj.data.polygons:
            face.use_smooth = True
        if role == 'source' and obj.data.color_attributes:
            material = scene.paint('Painted miniature source', (1, 1, 1), .88)
            colour = material.node_tree.nodes.new('ShaderNodeVertexColor')
            colour.layer_name = obj.data.color_attributes[0].name
            material.node_tree.links.new(colour.outputs['Color'], material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
            obj.data.materials.clear()
            obj.data.materials.append(material)
        for material in obj.data.materials:
            for node in material.node_tree.nodes:
                if node.type == 'NORMAL_MAP':
                    node.inputs['Strength'].default_value = .35
    scene.export_glb(folder/('model.glb' if role == 'render' else f'model-{role}.glb'), shadow=role == 'shadow')
    if role == 'render':
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=str(folder/'model.blend'))
        scene.render(folder, [('preview', 210, 15), ('back', 30, 25), ('left', 90, 25), ('right', 270, 25), ('top', 180, 78)])
    if role == 'lod':
        scene.render(folder, [('lod-preview', 180, 25), ('lod-top', 180, 78)])
(folder/'placement.json').write_text(json.dumps({'nativeFootprintDiameter': args.footprint,
    'nominalFootprintCells': [args.token_size, args.token_size], 'embeddedBase': False,
    'origin': 'feet at Y=0; unit geometry multiplied once by token.size',
    'transform': [list(row) for row in transform]}, indent=2)+'\n')
