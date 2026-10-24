#!/usr/bin/env python3
"""Build a local visual hull from eight already-generated calibrated views."""
import argparse
import json
from pathlib import Path

import numpy as np
import trimesh
from scipy.ndimage import gaussian_filter
from skimage.measure import marching_cubes
from trellis_views import extract_views, project, sample, FOCAL


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--resolution', type=int, default=320)
    args = parser.parse_args()
    views = extract_views(args.directory)
    n = args.resolution
    grid = np.linspace(-.55, .55, n, dtype=np.float32)
    field = np.empty((n,n,n), dtype=np.float32)
    yy, zz = np.meshgrid(grid, grid, indexing='ij')
    for i, x in enumerate(grid):
        points = np.column_stack([np.full(n*n, x), yy.ravel(), zz.ravel()])
        values = np.full(n*n, 1, dtype=np.float32)
        for k, view in enumerate(views):
            uv, depth = project(points, k)
            sdf = sample(view['sdf'], uv) * depth / (1024 * FOCAL)
            values = np.minimum(values, sdf)
        field[i] = values.reshape(n,n)
        if i % 40 == 0: print(f'Hull slices {i}/{n}', flush=True)
    field = gaussian_filter(field, .45)
    vertices, faces, _, _ = marching_cubes(field, level=0, spacing=(1.1/(n-1),)*3)
    vertices -= .55
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=True)
    if mesh.volume < 0: mesh.invert()
    components = mesh.split(only_watertight=False)
    mesh = trimesh.util.concatenate([m for m in components if len(m.faces) > 80])
    trimesh.smoothing.filter_taubin(mesh, lamb=.35, nu=.36, iterations=4)
    mesh.export(args.directory/'reconstructed-hull.ply')
    np.savez_compressed(args.directory/'reconstructed-hull.npz', vertices=mesh.vertices.astype('f4'), faces=mesh.faces.astype('i4'))
    info = {'method':'calibrated visual hull from generated 8-view previews', 'grid':n, 'vertices':len(mesh.vertices), 'triangles':len(mesh.faces), 'bounds':mesh.bounds.tolist(), 'watertight':mesh.is_watertight}
    (args.directory/'reconstruction.json').write_text(json.dumps(info,indent=2)+'\n')
    print(json.dumps(info),flush=True)


if __name__ == '__main__': main()
