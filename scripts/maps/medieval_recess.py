"""Preserve a native stairwell inside the shared UD-016 outer mounting envelope."""
import json
import math
from pathlib import Path
import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from recess_triangulation import triangulate_recess

PROFILE = json.loads((Path(__file__).parent/'standard-mount-profile.json').read_text())
OUTER_MATERIAL = 'UD-016 recessed insertion'
HIDDEN_MATERIAL = 'Recess well underside'


def _topology(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    result = dict(vertices=len(bm.verts), faces=len(bm.faces),
                  boundaryEdges=sum(e.is_boundary for e in bm.edges),
                  wireEdges=sum(e.is_wire for e in bm.edges),
                  multiEdges=sum(len(e.link_faces)>2 for e in bm.edges),
                  inconsistentEdges=sum(e.is_manifold and not e.is_contiguous for e in bm.edges),
                  volume=bm.calc_volume(signed=True))
    bm.free()
    return result


def _copy(obj, name):
    result = bpy.data.objects.new(name, obj.data.copy())
    bpy.context.collection.objects.link(result)
    return result


def _boolean(obj, operand, operation, solver='MANIFOLD'):
    obj.update_tag(refresh={'DATA'})
    operand.update_tag(refresh={'DATA'})
    bpy.context.view_layer.update()
    mod = obj.modifiers.new(operation, 'BOOLEAN')
    mod.operation, mod.solver, mod.object = operation, solver, operand
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.update()
    return obj


def _cube(name, lo, hi, material):
    bpy.ops.mesh.primitive_cube_add(size=2, location=tuple((a+c)/2 for a, c in zip(lo, hi)))
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple((c-a)/2 for a, c in zip(lo, hi))
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    obj.data.materials.append(material)
    return obj


def assert_no_recess(source, recipe):
    """A solid replacement must never erase a visible surface below its datum."""
    datum = recipe['mountDepthMM']
    if not datum:
        return
    tree = BVHTree.FromObject(source, bpy.context.evaluated_depsgraph_get())
    top = max(v.co.z for v in source.data.vertices)+1
    for cx, cy in recipe.get('pegCentersMM', [recipe['mountCenterMM']]):
        for x in [-12.25, -6.125, 0, 6.125, 12.25]:
            for y in [-12.25, -6.125, 0, 6.125, 12.25]:
                hit = tree.ray_cast((cx+x, cy+y, top), (0, 0, -1))
                if hit[0] is not None and hit[0].z < datum-.05:
                    raise ValueError('Visible native recess below mount datum; a measured hollow profile is required')


def _cavity(source, half, datum, earth, body):
    void = _cube('Native recess air', [-half, -half, -1], [half, half, datum], earth)
    _boolean(void, source, 'DIFFERENCE', 'EXACT')
    parent = list(range(len(void.data.vertices)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for edge in void.data.edges:
        a, c = edge.vertices
        parent[find(a)] = find(c)
    roots = {find(v.index) for v in void.data.vertices if abs(v.co.z-datum)<.0001}
    if len(roots) != 1:
        raise ValueError('Expected one native cavity component inside the probe boundary')
    root = roots.pop()
    keep = {v.index for v in void.data.vertices if find(v.index)==root}
    bm = bmesh.new()
    bm.from_mesh(void.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index not in keep], context='VERTS')
    if bm.calc_volume(signed=True)<0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    bm.to_mesh(void.data)
    bm.free()
    void.data.materials.clear()
    void.data.materials.append(body)
    void.data.materials.append(earth)
    for face in void.data.polygons:
        face.material_index = int(all(abs(void.data.vertices[i].co.z-datum)<.0001 for i in face.vertices))
    topology = _topology(void)
    if any(topology[k] for k in ['boundaryEdges', 'wireEdges', 'multiEdges', 'inconsistentEdges']):
        raise ValueError('Native cavity is not closed and consistently oriented')
    return void


def _outer_face(obj, face, datum):
    depth = PROFILE['depth']*35
    bottom, top = PROFILE['bottomWidth']*17.5, PROFILE['topWidth']*17.5
    low = datum-depth
    slope = (top-bottom)/depth
    intercept = bottom-slope*low
    points = [obj.data.vertices[i].co for i in face.vertices]
    if any(p.z<low-.0001 or p.z>datum+.0001 or max(abs(p.x), abs(p.y))>bottom+slope*(p.z-low)+.0001 for p in points):
        return False
    planes = [((0, 0, -1), -low), ((0, 0, 1), datum),
              ((1, 0, -slope), intercept), ((-1, 0, -slope), intercept),
              ((0, 1, -slope), intercept), ((0, -1, -slope), intercept)]
    return any(face.normal.dot(Vector(n).normalized())>.9 and
               all(abs(Vector(n).dot(p)-d)<.0001*Vector(n).length for p in points)
               for n, d in planes)


def _part(obj, name, selected):
    result = _copy(obj, name)
    bm = bmesh.new()
    bm.from_mesh(result.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in selected], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(result.data)
    bm.free()
    result.data.materials.clear()
    for face in result.data.polygons:
        face.material_index = 0
    return result


def interface_edges(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    edges = {tuple(sorted(tuple(round(c, 6) for c in v.co) for v in e.verts))
             for e in bm.edges if e.is_boundary}
    bm.free()
    return edges


def pin_recess(target, protected):
    bm = bmesh.new()
    bm.from_mesh(target.data)
    bm.verts.ensure_lookup_table()
    boundary = {v.index for e in bm.edges if e.is_boundary for v in e.verts}
    bm.free()
    group = target.vertex_groups.new(name='Recess interior collapse')
    eligible = [v.index for v in target.data.vertices if v.index not in boundary and tuple(v.co) not in protected]
    group.add(eligible, 1, 'REPLACE')
    return group.name, interface_edges(target)


def verify_recess_collapse(target, before):
    if interface_edges(target) != before:
        raise ValueError('Simplification changed a recess material interface')
    topology = _topology(target)
    if topology['wireEdges'] or topology['multiEdges'] or topology['inconsistentEdges']:
        raise ValueError('Simplification changed recess topology')
    return dict(interfaceEdges=len(before), wireEdges=0, multiEdges=0, inconsistentEdges=0)


def prepare_recess(source, recipe, source_hash):
    settings, datum = recipe['recessMount'], recipe['mountDepthMM']
    if recipe['width']!=1 or recipe['height']!=1 or recipe['mountCenterMM']!=[0, 0]:
        raise ValueError('A recessed mounting system needs its individually measured single-cell geometry')
    if recipe.get('plainMountCollarMM', 0):
        raise ValueError('A plain collar would cover native recessed surfaces')
    original_objects = set(bpy.data.objects)
    body_mat = bpy.data.materials.new('Native painted stairwell')
    earth = bpy.data.materials.new(OUTER_MATERIAL)
    earth.use_nodes = True
    shader = earth.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.065, .045, .025, 1)
    shader.inputs['Roughness'].default_value = .97
    source.data.materials.clear()
    source.data.materials.append(body_mat)
    source.data.materials.append(earth)
    native_topology = _topology(source)
    if any(native_topology[k] for k in ['boundaryEdges', 'wireEdges', 'multiEdges', 'inconsistentEdges']):
        raise ValueError('Native recessed source must be closed and consistently oriented')
    if native_topology['volume'] < 0:
        bm = bmesh.new()
        bm.from_mesh(source.data)
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
        bm.to_mesh(source.data)
        bm.free()
    original_tree = BVHTree.FromObject(source, bpy.context.evaluated_depsgraph_get())
    sky = max(v.co.z for v in source.data.vertices)+1
    probe_top = settings.get('probeTopMM', sky)
    if (not math.isfinite(probe_top) or
            probe_top <= max(datum, recipe.get('surfaceHeightMM', datum))+.05 or
            probe_top > sky):
        raise ValueError('Recess probe top must be above the measured rim and below the source sky')
    cavity_probes = []
    half = settings['probeHalfMM']
    for x in np.linspace(-half, half, 65):
        for y in [-10, -5, 0, 5, 10]:
            hit = original_tree.ray_cast((float(x), y, probe_top), (0, 0, -1))
            if hit[0] is not None and hit[0].z < datum-.05 and hit[1].z > 0.25:
                cavity_probes.append(list(hit[0]))
    if not cavity_probes:
        raise ValueError('A recessed profile requires measured visible surfaces below its datum')
    void = _cavity(source, settings['probeHalfMM'], datum, earth, body_mat)
    expanded = _copy(void, 'Hidden well envelope')
    bpy.context.view_layer.objects.active = expanded
    mod = expanded.modifiers.new('Hidden envelope budget', 'DECIMATE')
    mod.ratio = min(1, settings['envelopeTriangles']/len(expanded.data.polygons))
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bm = bmesh.new()
    bm.from_mesh(expanded.data)
    bm.normal_update()
    if bm.calc_volume(signed=True)<0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
        bm.normal_update()
    normals = [v.normal.copy() for v in bm.verts]
    for vertex, normal in zip(bm.verts, normals):
        vertex.co += normal*settings['hiddenWallMM']
    bm.to_mesh(expanded.data)
    bm.free()
    expanded.data.materials.clear()
    expanded.data.materials.append(earth)
    for face in expanded.data.polygons:
        face.material_index = 0
    retained = _boolean(_copy(source, 'Native well shell'), expanded, 'INTERSECT')
    upper_limit = max(75, max(v.co.z for v in source.data.vertices)+1)
    upper = _boolean(_copy(source, 'Native recess body'),
                     _cube('Upper body clip', [-40, -40, datum-.5], [40, 40, upper_limit], earth), 'INTERSECT')
    depth = PROFILE['depth']*35
    vertices = [(sx*r, sy*r, z) for r, z in [(PROFILE['bottomWidth']*17.5, datum-depth), (PROFILE['topWidth']*17.5, datum)]
                for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
    faces = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7)]
    for i in range(4):
        j = (i+1) % 4
        faces.extend([(i, j, j+4), (i, j+4, i+4)])
    mesh = bpy.data.meshes.new('Shared UD-016 envelope')
    mesh.from_pydata(vertices, [], faces)
    mount = bpy.data.objects.new('Hollow UD-016 envelope', mesh)
    bpy.context.collection.objects.link(mount)
    mesh.materials.append(earth)
    mesh.materials.append(body_mat)
    _boolean(mount, void, 'DIFFERENCE')
    _boolean(upper, retained, 'UNION')
    _boolean(upper, mount, 'UNION')
    bm = bmesh.new()
    bm.from_mesh(upper.data)
    triangulation = triangulate_recess(bm)
    bm.verts.ensure_lookup_table()
    protected = {tuple(bm.verts[i].co) for i in triangulation.pop('protectedVertexIndices')}
    bm.to_mesh(upper.data)
    bm.free()
    upper.data.update()
    bpy.context.view_layer.update()
    topology = _topology(upper)
    if any(topology[k] for k in ['boundaryEdges', 'wireEdges', 'multiEdges', 'inconsistentEdges']):
        raise ValueError('Recess mounting construction is not closed')
    tree = BVHTree.FromObject(upper, bpy.context.evaluated_depsgraph_get())
    cavity_errors = [tree.find_nearest(face.center)[3] for face in void.data.polygons if face.material_index==0]
    upper_errors = [tree.find_nearest(face.center)[3] for face in source.data.polygons if face.center.z>datum+.0001]
    print('MEDIEVAL_RECESS_DEVIATIONS', max(cavity_errors), max(upper_errors), flush=True)
    tolerance_mm = PROFILE['tolerance']*35
    if max(cavity_errors)>tolerance_mm or max(upper_errors)>tolerance_mm:
        raise ValueError('Recess construction changed native visible geometry')
    body_faces = {f.index for f in upper.data.polygons if upper.data.materials[f.material_index]==body_mat}
    outer_faces = {f.index for f in upper.data.polygons if f.index not in body_faces and _outer_face(upper, f, datum)}
    hidden_faces = set(range(len(upper.data.polygons)))-body_faces-outer_faces
    body = _part(upper, 'Measured recessed body', body_faces)
    outer = _part(upper, OUTER_MATERIAL, outer_faces)
    hidden = _part(upper, HIDDEN_MATERIAL, hidden_faces)
    outer.data.materials.append(earth)
    underside = earth.copy()
    underside.name = HIDDEN_MATERIAL
    hidden.data.materials.append(underside)
    for aux in [outer, hidden]:
        aux.hide_render = aux.hide_viewport = True
    report = dict(profile='ud016-recess-v1', sourceSHA256=source_hash, nativeDatumMM=datum,
                  reference=PROFILE, topology=topology, triangulation=triangulation,
                  cavityFaces=len(cavity_errors), maximumCavityDeviationMM=max(cavity_errors),
                  cavityProbeTopMM=probe_top, cavityProbesMM=cavity_probes,
                  upperFaces=len(upper_errors), maximumUpperDeviationMM=max(upper_errors),
                  constructionToleranceMM=tolerance_mm,
                  outerTriangles=len(outer.data.polygons), hiddenTriangles=len(hidden.data.polygons))
    keep = {body, outer, hidden}
    for obj in set(bpy.data.objects)-original_objects-keep:
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.objects.remove(source, do_unlink=True)
    summary = {k: v for k, v in report.items() if k!='cavityProbesMM'}
    print('MEDIEVAL_RECESS_CONSTRUCTION', summary, 'visibilityProbes', len(cavity_probes), flush=True)
    return body, [outer, hidden], protected, report
