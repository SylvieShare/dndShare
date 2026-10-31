"""Bounded, authored pose/debris correction without rebaking native materials."""
import bmesh
import numpy as np
from mathutils import Vector


def repair_pose(obj, settings):
    mesh = obj.data
    up = np.asarray(settings['sourceUp'], dtype=float)
    if up.shape != (3,) or not np.isfinite(up).all() or np.linalg.norm(up) < 1e-8:
        raise ValueError('Authored sourceUp must be a finite nonzero three-vector')
    up /= np.linalg.norm(up)
    values = [settings[k] for k in ['debrisBelow', 'feetMinimumY', 'feetMinimumAbsX', 'maxLiftDistance']]
    if not np.isfinite(values).all() or values[2] <= 0 or values[3] <= 0:
        raise ValueError('Explicit finite pose regions and positive lift bounds required')
    max_faces, max_vertices = settings['maxRemovedFaces'], settings['maxLiftVertices']
    if not isinstance(max_faces, int) or not 0 <= max_faces <= 1000 or not isinstance(max_vertices, int) or not 0 <= max_vertices <= 5000:
        raise ValueError('Bounded face/vertex counts required')
    sizes = np.empty(len(mesh.polygons), dtype=np.int32)
    mesh.polygons.foreach_get('loop_total', sizes)
    if not (sizes == 3).all():
        raise ValueError('Pose cleanup requires the native triangulated mesh')
    points = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get('co', points)
    points = points.reshape(-1, 3).astype(float)
    faces = np.empty(len(mesh.polygons) * 3, dtype=np.int32)
    mesh.polygons.foreach_get('vertices', faces)
    faces = faces.reshape(-1, 3)
    projected = points @ up
    below = projected[faces] < settings['debrisBelow']
    drop = below.all(axis=1)
    if (below.any(axis=1) & ~drop).any():
        raise ValueError('Debris plane intersects a source face')
    if int(drop.sum()) > max_faces or drop.all():
        raise ValueError('Debris removal exceeds the authored face bound')
    kept = np.unique(faces[~drop])
    feet = kept[(points[kept, 1] > settings['feetMinimumY']) &
                (abs(points[kept, 0]) > settings['feetMinimumAbsX'])]
    if not len(feet):
        raise ValueError('Authored foot region is empty')
    floor = float(projected[feet].min())
    lift = np.zeros(len(points))
    selected = kept[(points[kept, 1] < settings['feetMinimumY']) & (projected[kept] < floor)]
    lift[selected] = floor - projected[selected]
    if len(selected) > max_vertices or lift.max(initial=0) > settings['maxLiftDistance']:
        raise ValueError('Mouth contact correction exceeds its authored bounds')
    if (projected[kept] + lift[kept] < floor - 1e-7).any():
        raise ValueError('Unreviewed geometry remains below the selected feet')
    # All checks precede mutation. UV loops/materials are unchanged; only the
    # selected contact tips move, and the whole object receives one rigid tilt.
    points += lift[:, None] * up
    mesh.vertices.foreach_set('co', points.astype(np.float32).ravel())
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in np.flatnonzero(drop)], context='FACES')
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj.matrix_world = Vector(up.tolist()).rotation_difference(Vector((0, 0, 1))).to_matrix().to_4x4()
    return {'method': 'authored rigid leveling, bounded debris removal and mouth contact lift',
            'sourceUp': up.tolist(), 'removedFaces': int(drop.sum()),
            'selectedFaces': int(((lift[faces] > 0).any(axis=1) & ~drop).sum()),
            'liftedVertices': len(selected), 'maximumLift': float(lift.max(initial=0)),
            'footFloorBeforeLeveling': floor, 'preservedUVsAndMaterials': True,
            'bakeDevice': None, 'remoteGeneration': False}
