#!/usr/bin/env python3
"""Reviewed, geometry-only voxel closure for generator pinholes. Keeps the raw GLB."""
import argparse
import json
from pathlib import Path
import numpy as np
from scipy import ndimage
import trimesh

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('--pitch', type=float, required=True)
parser.add_argument('--radius', type=int, default=2)
args = parser.parse_args()
mesh = trimesh.load(args.source, force='mesh')
if not 0 < args.pitch < .1 or not 1 <= args.radius <= 4:
    raise ValueError('Explicit bounded voxel settings required')
if np.prod(np.ceil(mesh.extents/args.pitch)+2*args.radius+4) > 64_000_000:
    raise ValueError('Voxel closure exceeds the local memory budget')
voxels = mesh.voxelized(args.pitch)
padding = args.radius+2
shell = np.pad(voxels.matrix, padding)
grid = np.indices((2*args.radius+1,)*3)-args.radius
ball = (grid**2).sum(axis=0) <= args.radius**2
# Seal gaps while the shell is thick, fill its interior, then restore the outer
# size. Eroding before fill can reopen the shell and retain an inner cavity.
expanded = ndimage.binary_dilation(shell,structure=ball)
solid = ndimage.binary_erosion(ndimage.binary_fill_holes(expanded),structure=ball)
result = trimesh.voxel.ops.matrix_to_marching_cubes(solid,pitch=args.pitch)
result.apply_translation(voxels.transform[:3,3]-padding*args.pitch)
# Recompute normals from face winding; marching-cubes gradient normals can have
# the opposite direction and make an otherwise valid GLB render black.
result = trimesh.Trimesh(vertices=result.vertices,faces=result.faces,process=True)
result.fix_normals(multibody=True)
args.output.parent.mkdir(parents=True,exist_ok=True)
result.export(args.output)
args.output.with_suffix('.json').write_text(json.dumps({'pitch':args.pitch,'radius':args.radius,
    'sourceBounds':mesh.bounds.tolist(),'closedBounds':result.bounds.tolist(),
    'triangles':len(result.faces),'watertight':result.is_watertight},indent=2)+'\n')
