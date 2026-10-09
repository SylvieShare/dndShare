"""Protect measured broad cliff facets from vegetation in a changed bare sculpt."""
import math
import numpy as np


def stone_surface_mask(mesh, positions, settings):
    lo, hi = np.array(settings['boundsMM'][0]), np.array(settings['boundsMM'][1])
    eligible, seeds, edges = {}, [], {}
    for face in mesh.polygons:
        centre = np.array(face.center)
        if not np.all((centre >= lo) & (centre <= hi)):
            continue
        if face.normal.x > settings['normalXMax']:
            continue
        eligible[face.index] = face
        if face.area >= settings['minAreaMM2']:
            seeds.append(face.index)
        vertices = list(face.vertices)
        for a, b in zip(vertices, vertices[1:] + vertices[:1]):
            edges.setdefault(tuple(sorted((a, b))), []).append(face.index)
    adjacency = {index: [] for index in eligible}
    cosine = math.cos(settings['growAngleRad'])
    for neighbours in edges.values():
        for i in neighbours:
            for j in neighbours:
                if i != j and eligible[i].normal.dot(eligible[j].normal) >= cosine:
                    adjacency[i].append(j)
    protected = set(seeds)
    pending = list(seeds)
    while pending:
        for neighbour in adjacency[pending.pop()]:
            if neighbour not in protected:
                protected.add(neighbour)
                pending.append(neighbour)
    mask = np.zeros(len(positions), np.float32)
    for index in protected:
        mask[list(eligible[index].vertices)] = 1
    print('VEGETATION_STONE_SURFACE', len(seeds), len(protected), int(mask.sum()), flush=True)
    return mask
