"""Rebuild one sculpted body, preserve mounting meshes, then bake its new UVs."""
import argparse
import json
from pathlib import Path
import sys
import bpy
import numpy as np
from mathutils import Matrix, Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
from tile_mesh import activate, crop, shade
from mathutils.bvhtree import BVHTree


def bounds(obj):
    p = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return [[min(v[a] for v in p) for a in range(3)], [max(v[a] for v in p) for a in range(3)]]


def image_target(target, name, size, neutral):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    target.data.materials.clear()
    target.data.materials.append(mat)
    for face in target.data.polygons:
        face.material_index = 0
    image = bpy.data.images.new(name, width=size, height=size, alpha=False, is_data=True)
    image.colorspace_settings.name = 'Non-Color'
    image.generated_color = neutral
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = image
    mat.node_tree.nodes.active = node
    return image


def bake_tier(report, directory, tier):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 16
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 8
    bpy.ops.import_scene.gltf(filepath=str(directory/(tier+'-input.glb')))
    meshes = [o for o in scene.objects if o.type == 'MESH']
    targets = [o for o in meshes if o.data.uv_layers and any(m and m.name != 'Simple insertion pegs' for m in o.data.materials)]
    if len(targets) != 1:
        raise ValueError('One accepted baked body expected, got '+str(len(targets)))
    target = targets[0]
    for obj in meshes:
        obj.hide_render = obj != target
    target.matrix_world = Matrix.Scale(35, 4) @ target.matrix_world
    bpy.context.view_layer.update()
    before = bounds(target)
    original_materials = list(target.data.materials)
    mounting = [o for o in meshes if o != target]
    bpy.data.objects.remove(target, do_unlink=True)
    bpy.ops.wm.stl_import(filepath=report['sourcePath'])
    source = bpy.context.object
    crop(source, report['cutHeight'])
    correction = report.get('geometryCorrection',{})
    if correction.get('mode') == 'remove-false-mount':
        if report['model']['mountDepth'] <= 0:
            raise ValueError('Explicit hole correction must preserve its native mounting datum')
        for obj in mounting:
            bpy.data.objects.remove(obj, do_unlink=True)
        mounting = []
    for v in source.data.vertices:
        if correction.get('rotationXDeg') == 180:
            v.co.y = -v.co.y
            v.co.z = correction['rotationOriginZMM']-v.co.z
        v.co.x += report['sourceShiftMM'][0]
        v.co.y += report['sourceShiftMM'][1]
    source.data.update()
    shade(source)
    bpy.context.view_layer.update()
    sculpt = bounds(source)
    if not report.get('geometryCorrection') and max(abs(before[s][a]-sculpt[s][a]) for s in range(2) for a in [0,1]) > 1:
        raise ValueError('Accepted mesh and source have different XY coordinates')
    if not report.get('geometryCorrection') and abs(before[1][2]-sculpt[1][2]) > 1:
        raise ValueError('Accepted mesh and source have different heights')
    target = bpy.data.objects.new(report['model']['sourceCode']+' detailed body', source.data.copy())
    scene.collection.objects.link(target)
    datum = report['model']['mountDepth']*35
    if correction.get('mode') != 'remove-false-mount':
        crop(target, datum)
        for v in target.data.vertices:
            v.co.z += datum
    activate(target)
    modifier = target.modifiers.new('Reviewed body budget', 'DECIMATE')
    modifier.ratio = min(1, report['materialSpec'][tier+'Triangles']/len(target.data.polygons))
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    shade(target)
    if report['materialSpec'].get('flatFacets'):
        for obj in [source,target]:
            for face in obj.data.polygons:
                face.use_smooth = False
    water = report['materialSpec'].get('water', {})
    if water.get('normalMode') == 'planar':
        # A calm inset must not inherit the joined stone rim's smooth normals.
        # Keep every position/face and only override measured water corners.
        for obj in [source, target]:
            positions_before = [tuple(v.co) for v in obj.data.vertices]
            faces_before = [tuple(f.vertices) for f in obj.data.polygons]
            normals = [tuple(n.vector) for n in obj.data.corner_normals]
            water_faces = 0
            for face in obj.data.polygons:
                points = [obj.data.vertices[i].co for i in face.vertices]
                for surface in water['surfaces']:
                    cx, cy = surface['centre']
                    if face.normal.z > .95 and all(
                        abs(p.z-surface['heightMM']) < surface['toleranceMM']
                        and (p.x-cx)**2+(p.y-cy)**2 < surface['radiusMM']**2
                        for p in points
                    ):
                        for loop in face.loop_indices:
                            normals[loop] = (0, 0, 1)
                        water_faces += 1
                        break
            if not water_faces:
                raise ValueError('Measured planar water faces missing')
            obj.data.normals_split_custom_set(normals)
            if positions_before != [tuple(v.co) for v in obj.data.vertices] or \
                    faces_before != [tuple(f.vertices) for f in obj.data.polygons]:
                raise ValueError('Water normal correction changed geometry')
            print('CAVE_PLANAR_WATER_NORMALS', obj.name, water_faces, 'positions/faces unchanged', flush=True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    angle_limit=report['materialSpec'].get('uvAngleLimitRad',1.4)
    if not .2<=angle_limit<=1.4:
        raise ValueError('Reviewed UV projection angle outside supported range')
    bpy.ops.uv.smart_project(angle_limit=angle_limit, island_margin=.0015,
                             margin_method='FRACTION', area_weight=.8)
    bpy.ops.object.mode_set(mode='OBJECT')
    tree = BVHTree.FromObject(source, bpy.context.evaluated_depsgraph_get())
    sample = list(target.data.vertices)[::max(1,len(target.data.vertices)//1000)]
    checked_datum = 0 if correction.get('mode') == 'remove-false-mount' else datum
    distances = [tree.find_nearest(v.co)[3] for v in sample if v.co.z>checked_datum+.01]
    if max(distances,default=0)>1:
        raise ValueError('Detailed mesh strays more than1 mm from original sculpt')
    size = report['materialSpec'][tier+'BakeSize']
    normal = image_target(target, tier+'-normal', size, (.5,.5,1,1))
    activate(target)
    source.select_set(True)
    bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', use_selected_to_active=True,
                        cage_extrusion=.6, max_ray_distance=2, margin=12, use_clear=False)
    pixels = np.empty(size*size*4, np.float32)
    normal.pixels.foreach_get(pixels)
    rgba = pixels.reshape(-1,4)
    invalid = (~np.isfinite(rgba).all(1)) | (rgba[:,2] < .5)
    repaired = int(invalid.sum())
    rgba[invalid] = (.5,.5,1,1)
    normal.pixels.foreach_set(rgba.ravel())
    normal.filepath_raw = str(directory/(tier+'-normal.png'))
    normal.file_format = 'PNG'
    normal.save()
    ao = image_target(target, tier+'-ao', size, (1,1,1,1))
    activate(target)
    source.select_set(True)
    bpy.ops.object.bake(type='AO', use_selected_to_active=True, cage_extrusion=.6,
                        max_ray_distance=2, margin=12, use_clear=False)
    ao.pixels.foreach_get(pixels)
    rgba = pixels.reshape(-1,4)
    value = np.where(np.isfinite(rgba[:,0]), .65+.35*np.clip(rgba[:,0],0,1), 1)
    rgba[:,:3] = value[:,None]
    rgba[:,3] = 1
    ao.pixels.foreach_set(rgba.ravel())
    ao.filepath_raw = str(directory/(tier+'-ao.png'))
    ao.file_format = 'PNG'
    ao.save()
    target.data.materials.clear()
    for mat in original_materials:
        target.data.materials.append(mat)
    target.matrix_world = Matrix.Scale(1/35, 4) @ target.matrix_world
    activate(target)
    for obj in mounting:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(directory/(tier+'-repacked.glb')),
                             export_format='GLB', use_selection=True,
                             export_tangents=True, export_animations=False,
                             export_cameras=False, export_lights=False)
    print('LOST_CAVE_REBAKE', tier, size, repaired, before, sculpt, flush=True)
    return {'bakeSize':size, 'repairedOppositeNormals':repaired, 'acceptedBoundsMM':before,
            'sourceBoundsMM':sculpt, 'triangles':len(target.data.polygons), 'sourceDeviationMM':max(distances,default=0),
            'uvRepacked':True,
            'mountingMeshesRetained':len(mounting)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    report = json.loads(args.report.read_text())
    report['rebake'] = {tier:bake_tier(report,args.report.parent,tier) for tier in ['render','lod']}
    report['geometry'] = ('Native cropped sculpt restored without false synthetic mounting; original STL retained'
                          if report.get('geometryCorrection',{}).get('mode') == 'remove-false-mount'
                          else 'Body rebuilt from original sculpt at reviewed budgets; mounting meshes and accepted coordinates retained')
    args.report.write_text(json.dumps(report,indent=2)+'\n')
