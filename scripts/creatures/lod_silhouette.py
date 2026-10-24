"""Aligned orthographic geometry masks. No per-LOD fit, lighting or textures."""
import hashlib
import io
import json
import math
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

VIEWS = [(f'yaw-{yaw:03d}-elev-{elevation:02d}', yaw, elevation)
         for elevation in [0, 30] for yaw in range(0, 360, 45)] + [('top', 0, 90)]


def policy(overrides=None):
    defaults = json.loads(Path(__file__).with_name('lod-silhouette-policy.json').read_text())
    if set(overrides or {})-defaults.keys():
        raise ValueError('Unknown silhouette policy option')
    result = dict(defaults, **(overrides or {}))
    if type(result['resolution']) is not int or not 64 <= result['resolution'] <= 2048:
        raise ValueError('Silhouette resolution must be an integer from 64 to 2048')
    if not all(type(v) in (int, float) and math.isfinite(v) for v in result.values()):
        raise ValueError('Silhouette policy must be finite')
    if not 0 < result['minIoU'] <= 1 or not 0 < result['padding'] < .25:
        raise ValueError('Invalid silhouette overlap/padding policy')
    for key in ['maxMissingFraction', 'maxAddedFraction']:
        if not 0 <= result[key] < 1:
            raise ValueError('Invalid silhouette area policy')
    for key in ['maxEdgeP95Pixels', 'maxDistancePixels']:
        if not 0 <= result[key] <= result['resolution']:
            raise ValueError('Invalid silhouette boundary policy')
    return result


def geometry(path):
    import trimesh
    data = Path(path).read_bytes()
    if len(data) < 20 or data[:4] != b'glTF':
        raise ValueError('Silhouette input must be a GLB')
    header = json.loads(data[20:20+struct.unpack('<I', data[12:16])[0]])
    if any(m.get('alphaMode', 'OPAQUE') != 'OPAQUE' for m in header.get('materials', [])):
        raise ValueError('Alpha-masked/transparent models need a material-aware render comparison')
    scene = trimesh.load_scene(io.BytesIO(data), file_type='glb', skip_materials=True)
    mesh = scene.to_geometry()
    vertices, faces = np.asarray(mesh.vertices), np.asarray(mesh.faces)
    if not len(vertices) or not len(faces) or not np.isfinite(vertices).all():
        raise ValueError('Empty or non-finite silhouette geometry')
    return vertices, faces, hashlib.sha256(data).hexdigest()


def projection(vertices, yaw, elevation):
    yaw, elevation = math.radians(yaw), math.radians(elevation)
    right = np.array([math.cos(yaw), 0, -math.sin(yaw)])
    forward = np.array([math.sin(yaw)*math.cos(elevation), math.sin(elevation), math.cos(yaw)*math.cos(elevation)])
    up = np.cross(forward, right)
    return vertices @ np.stack([right, up], axis=1)


def masks(reference, candidate, yaw, elevation, settings):
    rp = projection(reference[0], yaw, elevation)
    lp = projection(candidate[0], yaw, elevation)
    low, high = rp.min(axis=0), rp.max(axis=0)
    span = max(high-low)/(1-2*settings['padding'])
    if span <= 0:
        raise ValueError('Reference has no projected area')
    size = settings['resolution']
    centre = (low+high)/2

    def raster(points, faces):
        pixels = (points-centre)/span*size*np.array([1, -1])+size/2
        clipped = np.count_nonzero(np.any((pixels < 0) | (pixels > size-1), axis=1))
        image = Image.new('1', (size, size))
        draw = ImageDraw.Draw(image)
        triangles = pixels[faces]
        # Degenerate projected triangles must not turn into artificial lines.
        a, b = triangles[:, 1]-triangles[:, 0], triangles[:, 2]-triangles[:, 0]
        visible = np.abs(a[:, 0]*b[:, 1]-a[:, 1]*b[:, 0]) > 1e-6
        for triangle in triangles[visible]:
            draw.polygon([tuple(p) for p in triangle], fill=1)
        return np.asarray(image, dtype=bool), int(clipped)

    a, _ = raster(rp, reference[1])
    b, clipped = raster(lp, candidate[1])
    return a, b, clipped


def measure(reference, candidate, clipped=0):
    area = int(reference.sum())
    union = int(np.count_nonzero(reference | candidate))
    intersection = int(np.count_nonzero(reference & candidate))
    a = reference & ~ndimage.binary_erosion(reference)
    b = candidate & ~ndimage.binary_erosion(candidate)
    if a.any() and b.any():
        # Measure changed silhouette area against the other *filled* mask.
        # Boundary-to-boundary distance mistakes a one-pixel interior pinhole
        # for a huge error just because the outer contour is far away.
        to_lod, to_reference = ndimage.distance_transform_edt(~candidate), ndimage.distance_transform_edt(~reference)
        distances = np.concatenate([to_lod[a], to_reference[b]])
        p95 = np.percentile(distances, 95)
        maximum = max(to_lod[reference].max(), to_reference[candidate].max())
    else:
        p95 = maximum = max(reference.shape)
    return {'iou': intersection/max(1, union),
            'missingFraction': int(np.count_nonzero(reference & ~candidate))/max(1, area),
            'addedFraction': int(np.count_nonzero(candidate & ~reference))/max(1, area),
            'edgeP95Pixels': float(p95), 'maxDistancePixels': float(maximum),
            'clippedVertices': clipped, 'referencePixels': area, 'lodPixels': int(candidate.sum())}


def accepted(metrics, settings):
    return (metrics['referencePixels'] > 0 and metrics['lodPixels'] > 0 and
            metrics['clippedVertices'] == 0 and metrics['iou'] >= settings['minIoU'] and
            metrics['maxDistancePixels'] <= settings['maxDistancePixels'] and
            all(metrics[key] <= settings['max'+key[0].upper()+key[1:]]
                for key in ['missingFraction', 'addedFraction', 'edgeP95Pixels']))


def overlay(reference, candidate):
    colours = np.zeros((*reference.shape, 3), dtype=np.uint8)
    colours[:] = (24, 28, 34)
    colours[reference & candidate] = (200, 209, 217)
    colours[reference & ~candidate] = (237, 84, 135)
    colours[candidate & ~reference] = (44, 203, 229)
    return Image.fromarray(colours)


def compare(reference, candidate, settings):
    results, images = [], []
    for name, yaw, elevation in VIEWS:
        a, b, clipped = masks(reference, candidate, yaw, elevation, settings)
        metrics = measure(a, b, clipped)
        results.append(dict(name=name, yaw=yaw, elevation=elevation,
                            passed=accepted(metrics, settings), **metrics))
        images.append(overlay(a, b))
    return results, images


def contact_sheet(results, images):
    width, height, columns = 280, 310, 4
    sheet = Image.new('RGB', (width*columns, 40+height*math.ceil(len(images)/columns)), (24, 28, 34))
    draw = ImageDraw.Draw(sheet)
    draw.text((10, 10), 'Grey: shared silhouette   Pink: missing in LOD   Cyan: added in LOD', fill='white')
    for index, (result, image) in enumerate(zip(results, images)):
        x, y = index % columns * width, 40+index // columns * height
        sheet.paste(image.resize((width, width), Image.Resampling.NEAREST), (x, y))
        label = f"{result['name']} IoU {result['iou']:.4f} {'PASS' if result['passed'] else 'FAIL'}"
        draw.text((x+6, y+width+4), label, fill='white' if result['passed'] else '#ed5487')
    return sheet
