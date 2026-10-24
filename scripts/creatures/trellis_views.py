"""Camera calibration and read-only view extraction for the TRELLIS.2 demo."""
import base64
import re
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, map_coordinates, minimum_filter

FOCAL = 0.5 / np.tan(np.deg2rad(36) / 2)


def camera(index):
    yaw = index * np.pi / 4 - np.deg2rad(16)
    pitch = np.deg2rad(20)
    eye = np.array([np.sin(yaw)*np.cos(pitch), np.cos(yaw)*np.cos(pitch), np.sin(pitch)]) * 2
    forward = -eye / np.linalg.norm(eye)
    right = np.cross(forward, [0, 0, 1]); right /= np.linalg.norm(right)
    down = np.cross(forward, right)
    return eye, np.stack([right, down, forward])


def project(points, index, size=1024):
    eye, rotation = camera(index)
    local = (points-eye) @ rotation.T
    coords = local[:, :2] / local[:, 2:3] * FOCAL + 0.5
    return coords * size - 0.5, local[:, 2]


def extract_views(directory):
    html = (directory / 'generation-preview.html').read_text()
    views = []
    for index in range(8):
        images = []
        for mode in [0, 2]:
            path = directory / f'reconstruction-{mode}-{index}.jpg'
            if not path.exists():
                match = re.search(r'id="view-m'+str(mode)+'-s'+str(index)+r'"[\s\S]*?src="data:image/jpeg;base64,([^\"]+)"', html)
                path.write_bytes(base64.b64decode(match.group(1)))
            images.append(np.asarray(Image.open(path).convert('RGB')))
        normals, colour = images
        normal = 1 - normals.astype(np.float32) / 127.5
        mask = np.linalg.norm(normal, axis=2) > .55
        sdf = distance_transform_edt(mask) - distance_transform_edt(~mask)
        views.append({'normal': normal, 'colour': colour, 'mask': mask, 'sdf': sdf.astype(np.float32)})
    return views


def sample(image, coordinates, order=1):
    coords = [coordinates[:, 1], coordinates[:, 0]]
    if image.ndim == 2:
        return map_coordinates(image, coords, order=order, mode='constant', cval=-1000)
    return np.stack([map_coordinates(image[..., i], coords, order=order, mode='nearest') for i in range(image.shape[2])], axis=-1)


def depth_maps(mesh, size=512):
    points = np.concatenate([mesh.vertices, mesh.triangles_center])
    maps = []
    for k in range(8):
        uv, z = project(points, k, size)
        uv = np.rint(uv).astype(int)
        valid = np.all((uv >= 0) & (uv < size), axis=1)
        depth = np.full(size*size, np.inf, dtype=np.float32)
        np.minimum.at(depth, uv[valid,1]*size+uv[valid,0], z[valid])
        depth = depth.reshape(size,size)
        indices = distance_transform_edt(~np.isfinite(depth), return_distances=False, return_indices=True)
        maps.append(minimum_filter(depth[tuple(indices)], size=3))
    return maps
