#!/usr/bin/env python3
"""Bake generated albedo and normals onto a locally reconstructed miniature.

This exports a reconstruction of calibrated views, never a native TRELLIS mesh.
All materials are matte dielectrics; there is no metal inference from pale fur.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import trimesh
import xatlas
from PIL import Image
from scipy.ndimage import distance_transform_edt
from trellis_views import extract_views, depth_maps
from multiview_texture import rasterize, project_views, tangent_frames


def bake(mesh, views, depths, size):
    print('Unwrapping', len(mesh.faces), 'triangles', flush=True)
    mapping, faces, uv = xatlas.parametrize(mesh.vertices.astype('f4'), mesh.faces.astype('u4'))
    vertices, normals = mesh.vertices[mapping], mesh.vertex_normals[mapping]
    positions, directions, ids = rasterize(vertices, faces, uv, normals, size)
    tangent, bitangent = tangent_frames(vertices, faces, uv)
    yy, xx = np.where(ids >= 0)
    colour = np.zeros((size, size, 3), dtype=np.uint8)
    normal = np.zeros_like(colour)
    for start in range(0, len(xx), 60000):
        x, y = xx[start:start+60000], yy[start:start+60000]
        p, n = positions[y, x], directions[y, x]
        rgb, observed = project_views(p, n, views, depths)
        face = ids[y, x]
        t = tangent[face]
        t = t - n * np.sum(t*n, axis=-1, keepdims=True)
        t /= np.maximum(1e-8, np.linalg.norm(t, axis=-1, keepdims=True))
        b = np.cross(n, t)
        b *= np.sign(np.sum(b*bitangent[face], axis=-1))[:, None]
        mapped = np.stack([np.sum(observed*t, axis=-1), np.sum(observed*b, axis=-1),
                           np.sum(observed*n, axis=-1)], axis=-1)
        colour[y, x] = rgb
        normal[y, x] = np.clip((mapped*.5+.5)*255, 0, 255).astype('u1')
    # Extend island edges into their padding to prevent dark minification seams.
    indices = distance_transform_edt(ids < 0, return_distances=False, return_indices=True)
    colour, normal = colour[tuple(indices)], normal[tuple(indices)]
    orm = np.empty_like(colour)
    orm[..., 0], orm[..., 1], orm[..., 2] = 255, 224, 0
    images = [Image.fromarray(image) for image in [colour, normal, orm]]
    return vertices, faces, uv, normals, images


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--views', type=Path, required=True)
    parser.add_argument('--source-only', action='store_true')
    args = parser.parse_args()
    folder = args.directory
    data = np.load(folder/'reconstructed-hull.npz')
    source = trimesh.Trimesh(data['vertices'], data['faces'], process=False)
    views, depths = extract_views(args.views), depth_maps(source)
    summary = []
    for role, target, size in [] if args.source_only else [('render', 44000, 2048), ('lod', 12000, 1024)]:
        mesh = source if len(source.faces) <= target else source.simplify_quadric_decimation(face_count=target, aggression=3)
        vertices, faces, uv, normals, images = bake(mesh, views, depths, size)
        colour, normal, orm = images
        for channel, image in zip(['basecolor', 'normal', 'orm'], images):
            image.save(folder/f'{role}-{channel}.png')
        material = trimesh.visual.material.PBRMaterial(name='Painted miniature '+role,
            baseColorTexture=colour, normalTexture=normal, metallicRoughnessTexture=orm,
            metallicFactor=1, roughnessFactor=1, doubleSided=False)
        result = trimesh.Trimesh(vertices=vertices, faces=faces, vertex_normals=normals,
            visual=trimesh.visual.TextureVisuals(uv=uv, material=material), process=False)
        result.apply_transform(trimesh.transformations.rotation_matrix(-np.pi/2, [1, 0, 0]))
        result.export(folder/f'body-{role}.glb')
        summary.append({'role': role, 'triangles': len(faces), 'textureSize': size})
        print('Baked', role, flush=True)
    # Keep the detailed source's topology, avoiding a huge, fragmented UV atlas.
    colour, _ = project_views(source.vertices, source.vertex_normals, views, depths)
    source.visual = trimesh.visual.ColorVisuals(source, vertex_colors=colour)
    original = source.copy()
    original.apply_transform(trimesh.transformations.rotation_matrix(-np.pi/2, [1, 0, 0]))
    original.export(folder/'body-source.glb')
    shadow = source.simplify_quadric_decimation(face_count=3500, aggression=5)
    shadow.apply_transform(trimesh.transformations.rotation_matrix(-np.pi/2, [1, 0, 0]))
    shadow.export(folder/'body-shadow.glb')
    (folder/'baking.json').write_text(json.dumps({'method': 'calibrated multiview reconstruction',
        'originalServiceMeshExported': False, 'sourceColour': 'projected vertex colours', 'assets': summary}, indent=2)+'\n')


if __name__ == '__main__':
    main()
