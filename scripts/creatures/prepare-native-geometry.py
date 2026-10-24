#!/usr/bin/env python3
"""Geometry-only QEM and fresh UVs before baking native generator materials."""
import argparse
from pathlib import Path
import numpy as np
import trimesh
import xatlas

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
parser.add_argument('--only', choices=['render','lod','shadow'])
parser.add_argument('--lod-triangles', type=int, default=12000)
args = parser.parse_args()
folder = args.directory
mesh = trimesh.load(folder / 'trellis-native/generated-original.glb', force='mesh')
mesh.visual = trimesh.visual.ColorVisuals(mesh)
mesh.merge_vertices(merge_tex=True, merge_norm=True, digits_vertex=5)
mesh.update_faces(mesh.nondegenerate_faces())
mesh.remove_unreferenced_vertices()
for role, count in [('render', 44000), ('lod', args.lod_triangles), ('shadow', 3500)]:
    if args.only and args.only != role:
        continue
    simplified = mesh.simplify_quadric_decimation(face_count=count, aggression=7 if role=='shadow' else 3)
    if role == 'shadow':
        result = trimesh.Trimesh(simplified.vertices, simplified.faces, process=False)
    else:
        mapping, faces, uv = xatlas.parametrize(simplified.vertices.astype('f4'), simplified.faces.astype('u4'))
        result = trimesh.Trimesh(simplified.vertices[mapping], faces,
            vertex_normals=simplified.vertex_normals[mapping],
            visual=trimesh.visual.TextureVisuals(uv=uv), process=False)
    result.export(folder / f'geometry-{role}.glb')
    print(role, len(result.faces), flush=True)
