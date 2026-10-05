"""Separate occupied cells from decorative mesh overhangs (35 mm per cell)."""
import math
import numpy as np


def section(triangles, plane):
    z = triangles[:, :, 2]
    crossing = triangles[(z.min(1) < plane) & (z.max(1) > plane)]
    points = []
    for i, j in [(0, 1), (1, 2), (2, 0)]:
        a, b = crossing[:, i], crossing[:, j]
        mask = (a[:, 2] < plane) != (b[:, 2] < plane)
        a, b = a[mask], b[mask]
        points.append(a + (b-a)*((plane-a[:, 2])/(b[:, 2]-a[:, 2]))[:, None])
    return np.concatenate(points)


def cells(spans):
    return [max(1, math.ceil(float(span)/35-.025)) for span in spans]


def footprint(row, triangles):
    """Keep structural meshes whole; infer mounted tiles from the body base.

    GLBs remain centred on the full source bounding box. placementOffset moves
    that origin to the mounting centre without cropping or scaling the mesh.
    """
    size = cells(np.asarray(row['max'])[:2]-np.asarray(row['min'])[:2])
    offset = [0, 0]
    depth = row['mountDepth']*35
    if depth > 0:
        base = section(triangles, row['cutHeight']+depth+.1)
        mount = section(triangles, row['cutHeight']+.1)
        if len(base) and len(mount):
            base_size = cells(np.ptp(base, axis=0)[:2])
            # A decorative part can enlarge the full bounding box, never shrink
            # the occupied base. Genuine multi-cell bases retain all their cells.
            if base_size != size and all(a <= b for a, b in zip(base_size, size)):
                size = base_size
                center = (mount.min(0)[:2]+mount.max(0)[:2])/2
                mesh_center = (np.asarray(row['min'])[:2]+np.asarray(row['max'])[:2])/2
                delta = (mesh_center-center)/35
                offset = [round(float(delta[0]), 6), round(float(-delta[1]), 6)]
    return {'width': size[0], 'height': size[1], 'placementOffset': offset}
