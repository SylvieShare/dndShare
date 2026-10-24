"""Remove skin hidden by fitted clothing, retaining exposed neck and armholes."""
import bmesh
from mathutils.bvhtree import BVHTree


def mask_covered_body(body, clothing):
    if not clothing.coverage:
        return 0
    vertices, faces = [], []
    for points, polygons in clothing.coverage:
        offset = len(vertices)
        vertices.extend(points)
        faces.extend([offset+i for i in face] for face in polygons)
    shell = BVHTree.FromPolygons(vertices, faces)
    mesh = bmesh.new()
    mesh.from_mesh(body.data)
    covered = []
    for face in mesh.faces:
        point = body.matrix_world @ face.calc_center_median()
        if not .425 < point.z < .68:
            continue
        samples = [body.matrix_world@v.co for v in face.verts]
        hidden = True
        for sample in samples:
            direction = sample-clothing.centre(sample.z)
            direction.z = 0
            if direction.length < .01:
                hidden = False
                break
            direction.normalize()
            # Distant limbs cannot be clipped. A whole face, rather than
            # its centroid alone, must lie under the inset garment patch.
            if shell.ray_cast(sample+direction*.04, -direction, .08)[0] is None:
                hidden = False
                break
        if hidden:
            covered.append(face)
    count = len(covered)
    bmesh.ops.delete(mesh, geom=covered, context='FACES')
    loose = [v for v in mesh.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(mesh, geom=loose, context='VERTS')
    mesh.to_mesh(body.data)
    mesh.free()
    body.data.update()
    if count < 10:
        raise ValueError('Fitted clothing did not cover any meaningful body surface')
    return count
