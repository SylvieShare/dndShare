"""Blender: review exported game GLBs, optionally on a separate token base."""
import argparse
import json
import sys
import bpy
from pathlib import Path
from mathutils import Matrix
sys.path.insert(0, str(Path(__file__).resolve().parent))
import miniature_scene as scene

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
parser.add_argument('--base', type=Path)
parser.add_argument('--base-diameter', type=float, help='Measured native outer diameter of the separate base')
parser.add_argument('--recipe', type=Path, required=True)
parser.add_argument('--token-size', type=float, default=1)
parser.add_argument('--surface-height', type=float, default=.06)
parser.add_argument('--grey', action='store_true', help='Also inspect geometry without baked colour/normal maps')
parser.add_argument('--grey-only', action='store_true')
parser.add_argument('--base-only', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
folder = args.directory.resolve()
scene.import_glb(folder/'model.glb')
if not args.grey_only and not args.base_only:
    scene.render(folder, [('preview',254,25),('back',74,25),('left',164,25),('right',344,25),('top',254,78)])
    scene.import_glb(folder/'model-lod.glb')
    scene.render(folder, [('lod-preview',254,25),('lod-top',254,78)])
if args.grey or args.grey_only:
    meshes = scene.import_glb(folder/'model.glb')
    material = scene.paint('Untextured geometry review',(.4,.4,.4))
    for obj in meshes:
        obj.data.materials.clear(); obj.data.materials.append(material)
    scene.render(folder,[('grey-preview',254,25),('grey-back',74,25),('grey-top',254,78)])
if args.base:
    body = scene.import_glb(folder/'model.glb')
    recipe = json.loads(args.recipe.read_text())
    reference = recipe['referenceDiameter']
    if not args.base_diameter or args.base_diameter <= 0 or reference <= 0:
        raise ValueError('Reviewed figure and base diameters required')
    diameter = args.token_size - min(.3, args.token_size * .3)
    body_scale = .7 * args.token_size / reference
    for obj in body:
        obj.matrix_world = Matrix.Translation((0,0,args.surface_height)) @ Matrix.Scale(body_scale,4) @ obj.matrix_world
    support = scene.import_glb(args.base.resolve(), replace=False)
    for obj in support:
        obj.matrix_world = Matrix.Diagonal((diameter / args.base_diameter, diameter / args.base_diameter, 1, 1)) @ obj.matrix_world
    scene.render(folder, [('on-base',254,20)], resolution=900)
