"""Blender: review exported game GLBs, optionally on a separate token base."""
import argparse
import sys
from pathlib import Path
from mathutils import Matrix
sys.path.insert(0, str(Path(__file__).resolve().parent))
import miniature_scene as scene

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
parser.add_argument('--base', type=Path)
parser.add_argument('--token-size', type=float, default=1)
parser.add_argument('--surface-height', type=float, default=.06)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
folder = args.directory.resolve()
scene.import_glb(folder/'model.glb')
scene.render(folder, [('preview',254,25),('back',74,25),('left',164,25),('right',344,25),('top',254,78)])
scene.import_glb(folder/'model-lod.glb')
scene.render(folder, [('lod-preview',254,25),('lod-top',254,78)])
if args.base:
    body = scene.import_glb(folder/'model.glb')
    for obj in body:
        obj.matrix_world = Matrix.Translation((0,0,args.surface_height)) @ Matrix.Scale(args.token_size,4) @ obj.matrix_world
    scene.import_glb(args.base.resolve(), replace=False)
    scene.render(folder, [('on-base',254,20)], resolution=900)
