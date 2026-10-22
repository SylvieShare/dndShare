"""Upper sculpt components for measured material references in native millimetres."""
from collections import Counter
import math

from mathutils.bvhtree import BVHTree


def source_component_tree(obj, above_mm, component_index=0, bounds_mm=None):
    if (not math.isfinite(above_mm) or not isinstance(component_index, int)
            or component_index < 0):
        raise ValueError('Finite height and nonnegative integer component rank required')
    mesh = obj.data
    valid = [vertex.co.z > above_mm for vertex in mesh.vertices]
    if bounds_mm is not None:
        lo, hi = bounds_mm['minMM'], bounds_mm['maxMM']
        if (len(lo)!=3 or len(hi)!=3 or
                not all(math.isfinite(lo[i]) and math.isfinite(hi[i]) and lo[i]<hi[i] for i in range(3))):
            raise ValueError('Finite component bounds required')
        valid = [keep and all(lo[i]<=vertex.co[i]<=hi[i] for i in range(3))
                 for keep, vertex in zip(valid, mesh.vertices)]
    parent = list(range(len(valid)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for edge in mesh.edges:
        a, b = edge.vertices
        if valid[a] and valid[b]:
            parent[find(a)] = find(b)
    counts = Counter(find(i) for i, keep in enumerate(valid) if keep)
    components = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    if component_index >= len(components):
        raise ValueError('Requested source component does not exist')
    selected = components[component_index][0]
    # Preserve complete faces crossing the sampling height instead of cutting holes.
    faces = [tuple(face.vertices) for face in mesh.polygons
             if any(valid[i] and find(i) == selected for i in face.vertices)]
    if not faces:
        raise ValueError('Selected component has no source triangles')
    stats = dict(components=len(components), counts=[count for _, count in components],
                 vertices=components[component_index][1], triangles=len(faces))
    tree = BVHTree.FromPolygons([v.co for v in mesh.vertices], faces, all_triangles=True)
    return tree, stats
