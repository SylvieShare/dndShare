"""Triangulate Boolean faces without reusing a neighbouring face's diagonal."""
import bmesh


def triangulate_recess(bm):
    """Preserve polygon geometry and material interfaces, including concave faces.

    A Boolean n-gon can contain a chord already used by adjacent faces. Split
    that internal diagonal and its incident triangles with new interior points;
    the original boundary and every original vertex remain unchanged.
    """
    bm.normal_update()
    constrained = 0
    protected = set()
    steiner = 0
    for face in list(bm.faces):
        if len(face.verts) <= 3:
            continue
        vertices = list(face.verts)
        members, border = set(vertices), set(face.edges)
        forbidden = {frozenset((vertex, edge.other_vert(vertex)))
                     for vertex in vertices for edge in vertex.link_edges
                     if edge not in border and edge.other_vert(vertex) in members}
        if not forbidden:
            bmesh.ops.triangulate(bm, faces=[face], ngon_method='EAR_CLIP')
            continue
        constrained += 1
        protected.update(vertices)
        temporary = bmesh.new()
        copies = [temporary.verts.new(vertex.co) for vertex in vertices]
        temporary.verts.index_update()
        polygon = temporary.faces.new(copies)
        temporary.normal_update()
        bmesh.ops.triangulate(temporary, faces=[polygon], ngon_method='EAR_CLIP')
        triangles = [tuple(vertices[v.index] for v in f.verts) for f in temporary.faces]
        temporary.free()
        material = face.material_index
        bm.faces.remove(face)
        midpoints = {}
        for triangle in triangles:
            keys = [frozenset((triangle[i], triangle[(i+1) % 3])) for i in range(3)]
            if not any(key in forbidden for key in keys):
                created = bm.faces.new(triangle)
                created.material_index = material
                continue
            boundary = []
            for i, vertex in enumerate(triangle):
                boundary.append(vertex)
                if keys[i] in forbidden:
                    if keys[i] not in midpoints:
                        other = triangle[(i+1) % 3]
                        midpoints[keys[i]] = bm.verts.new((vertex.co+other.co)/2)
                        protected.add(midpoints[keys[i]])
                        steiner += 1
                    boundary.append(midpoints[keys[i]])
            centre = bm.verts.new((triangle[0].co+triangle[1].co+triangle[2].co)/3)
            protected.add(centre)
            steiner += 1
            for i, vertex in enumerate(boundary):
                created = bm.faces.new((vertex, boundary[(i+1) % len(boundary)], centre))
                created.material_index = material
    bm.normal_update()
    if any(len(edge.link_faces) > 2 for edge in bm.edges):
        raise ValueError('Triangulation created a non-manifold edge')
    if any(len(face.verts) != 3 for face in bm.faces):
        raise ValueError('Boolean face was not triangulated')
    bm.verts.index_update()
    return {'constrainedFaces': constrained, 'steinerVertices': steiner,
            'protectedVertexIndices': sorted(v.index for v in protected),
            'triangles': len(bm.faces)}
