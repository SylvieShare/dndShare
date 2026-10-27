#!/usr/bin/env python3
"""Geometry-only QEM and fresh UVs before baking native generator materials."""
import argparse
import json
from pathlib import Path
import numpy as np
import trimesh
import xatlas

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
parser.add_argument('--only', choices=['render','lod','shadow'])
parser.add_argument('--render-triangles',type=int,default=44000)
parser.add_argument('--lod-triangles', type=int, default=12000)
parser.add_argument('--source', type=Path, help='Explicit native GLB for a staged build')
parser.add_argument('--drop-components-below', type=int, default=0, help='Reviewed removal of tiny disconnected triangle islands after welding')
parser.add_argument('--fill-small-holes', action='store_true', help='Reviewed repair of triangular/quadrilateral boundary holes')
parser.add_argument('--lod-aggression', type=int, default=3)
parser.add_argument('--shadow-triangles', type=int, default=3500)
parser.add_argument('--shadow-hull',action='store_true',help='Reviewed convex shadow proxy for a solid volume, e.g. gelatinous cube')
parser.add_argument('--shadow-aggression', type=int, default=7)
args = parser.parse_args()
folder = args.directory
folder.mkdir(parents=True,exist_ok=True)
mesh = trimesh.load(args.source or folder / 'trellis-native/generated-original.glb', force='mesh')
mesh.visual = trimesh.visual.ColorVisuals(mesh)
mesh.merge_vertices(merge_tex=True, merge_norm=True, digits_vertex=5)
mesh.update_faces(mesh.nondegenerate_faces())
mesh.remove_unreferenced_vertices()
removed = 0
if args.drop_components_below:
    components = trimesh.graph.connected_components(mesh.face_adjacency,nodes=np.arange(len(mesh.faces)),min_len=1)
    mask = np.ones(len(mesh.faces),dtype=bool)
    for component in components:
        if len(component) < args.drop_components_below: mask[component] = False
    removed = int((~mask).sum())
    mesh.update_faces(mask);mesh.remove_unreferenced_vertices()
report = {'removedIslandFaces':removed,'roles':{}}
render_mesh=None
for role, count in [('render', args.render_triangles), ('lod', args.lod_triangles), ('shadow', args.shadow_triangles)]:
    input_mesh=render_mesh if role=='lod' and render_mesh is not None else mesh
    if role=='shadow' and args.shadow_hull:
        input_mesh=mesh.convex_hull
        report['shadowHull']=True
    simplified = input_mesh.copy() if len(input_mesh.faces)<=count else input_mesh.simplify_quadric_decimation(face_count=count, aggression=args.shadow_aggression if role=='shadow' else args.lod_aggression if role=='lod' else 3)
    before = len(simplified.faces)
    if args.fill_small_holes: trimesh.repair.fill_holes(simplified)
    # QEM can lift the lowest contact point. Keep that contact in source space,
    # without translating a whole role relative to the common body transform.
    floor = mesh.bounds[0,1]
    contact = simplified.vertices[:,1].argmin()
    displacement = float(simplified.vertices[contact,1]-floor)
    if abs(displacement) < np.ptp(mesh.vertices[:,1])*.025:
        simplified.vertices[:,1] = np.maximum(simplified.vertices[:,1],floor)
        simplified.vertices[contact,1] = floor
    if role=='render':render_mesh=simplified.copy()
    if args.only and args.only != role:continue
    report['roles'][role] = {'targetTriangles':count,'actualTriangles':len(simplified.faces),'filledFaces':len(simplified.faces)-before,'contactAdjustment':displacement}
    if len(simplified.faces)>count:raise ValueError(f'QEM reached {len(simplified.faces)} faces, exceeding authored {role} budget {count}')
    if role == 'shadow':
        result = trimesh.Trimesh(simplified.vertices, simplified.faces, process=False)
    else:
        mapping, faces, uv = xatlas.parametrize(simplified.vertices.astype('f4'), simplified.faces.astype('u4'))
        result = trimesh.Trimesh(simplified.vertices[mapping], faces,
            vertex_normals=simplified.vertex_normals[mapping],
            visual=trimesh.visual.TextureVisuals(uv=uv), process=False)
    result.export(folder / f'geometry-{role}.glb')
    print(role, len(result.faces), flush=True)
(folder/'geometry-report.json').write_text(json.dumps(report,indent=2)+'\n')
