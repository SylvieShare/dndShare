"""Rebuild one sculpted body, preserve mounting meshes, then bake its new UVs."""
import argparse
import json
from pathlib import Path
import sys
import bpy
import numpy as np
from mathutils import Matrix, Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
from tile_mesh import activate, shade
from sewer_crop import crop, clip_mount
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
    for v in source.data.vertices:
        v.co.x += report['sourceShiftMM'][0]
        v.co.y += report['sourceShiftMM'][1]
    shade(source)
    bpy.context.view_layer.update()
    sculpt = bounds(source)
    if max(abs(before[s][a]-sculpt[s][a]) for s in range(2) for a in [0,1]) > 1:
        raise ValueError('Accepted mesh and source have different XY coordinates')
    if abs(before[1][2]-sculpt[1][2]) > 1:
        raise ValueError('Accepted mesh and source have different heights')
    target = bpy.data.objects.new(report['model']['sourceCode']+' detailed body', source.data.copy())
    scene.collection.objects.link(target)
    datum = report['model']['mountDepth']*35
    mount_source_bounds = None
    if report['materialSpec'].get('mounting') == 'source-opening':
        for obj in mounting:
            bpy.data.objects.remove(obj, do_unlink=True)
        mount = bpy.data.objects.new('Source insertion geometry', source.data.copy())
        scene.collection.objects.link(mount)
        clip_mount(mount, datum)
        bpy.context.view_layer.update()
        mount_source_bounds = bounds(mount)
        activate(mount)
        modifier = mount.modifiers.new('Open mounting budget', 'DECIMATE')
        modifier.ratio = min(1, report['materialSpec'][tier+'MountTriangles']/len(mount.data.polygons))
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        for vertex in mount.data.vertices:
            if vertex.co.z < -.1 or vertex.co.z > datum+.1:
                raise ValueError('Mount decimation moved a cut plane more than0.1 mm')
            if vertex.co.z < .05:
                vertex.co.z = 0
            elif vertex.co.z > datum-.05:
                vertex.co.z = datum
        shade(mount)
        mat = bpy.data.materials.new('Simple insertion pegs — source opening')
        mat.use_nodes = True
        shader = mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (.13, .15, .085, 1)
        shader.inputs['Roughness'].default_value = .9
        mount.data.materials.clear()
        mount.data.materials.append(mat)
        for face in mount.data.polygons:
            face.material_index = 0
        inner_colour = report['materialSpec'].get('mountInnerColor')
        if inner_colour:
            inner = bpy.data.materials.new('Simple insertion pegs — exposed pit rock')
            inner.use_nodes = True
            shader = inner.node_tree.nodes.get('Principled BSDF')
            def linear(v):
                s = v/255
                return s/12.92 if s <= .04045 else ((s+.055)/1.055)**2.4
            shader.inputs['Base Color'].default_value = (*[linear(v) for v in inner_colour], 1)
            shader.inputs['Roughness'].default_value = .89
            mount.data.materials.append(inner)
            for face in mount.data.polygons:
                centre = face.center
                x = centre.x-report['sourceShiftMM'][0]
                y = centre.y-report['sourceShiftMM'][1]
                if x*face.normal.x+y*face.normal.y < -.1:
                    face.material_index = 1
        mount.matrix_world = Matrix.Scale(1/35, 4) @ mount.matrix_world
        mounting = [mount]
        report['mountingCorrection'] = {'method': 'Source annular mounting geometry',
                                       'reason': report['materialSpec']['mountingCorrectionReason']}
    crop(target, datum)
    for v in target.data.vertices:
        v.co.z += datum
    activate(target)
    modifier = target.modifiers.new('Reviewed body budget', 'DECIMATE')
    modifier.ratio = min(1, report['materialSpec'][tier+'Triangles']/len(target.data.polygons))
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    shade(target)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.4, island_margin=.0015,
                             margin_method='FRACTION', area_weight=.8)
    bpy.ops.object.mode_set(mode='OBJECT')
    tree = BVHTree.FromObject(source, bpy.context.evaluated_depsgraph_get())
    sample = list(target.data.vertices)[::max(1,len(target.data.vertices)//1000)]
    distances = [tree.find_nearest(v.co)[3] for v in sample if v.co.z>datum+.01]
    if max(distances,default=0)>1:
        raise ValueError('Detailed mesh strays more than1 mm from original sculpt')
    for px, py in report['materialSpec'].get('openingProbesMM', []):
        probe = Vector((px+report['sourceShiftMM'][0], py+report['sourceShiftMM'][1], sculpt[1][2]+1))
        if BVHTree.FromObject(target, bpy.context.evaluated_depsgraph_get()).ray_cast(probe, Vector((0, 0, -1)))[0] is not None:
            raise ValueError('Body preparation filled the source shaft')
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
    print('TOXIC_SEWER_REBAKE', tier, size, repaired, before, sculpt, flush=True)
    return {'bakeSize':size, 'repairedOppositeNormals':repaired, 'acceptedBoundsMM':before,
            'sourceBoundsMM':sculpt, 'triangles':len(target.data.polygons), 'sourceDeviationMM':max(distances,default=0),
            'uvRepacked':True,
            'mountingMeshesRetained':len(mounting), 'mountSourceBoundsMM':mount_source_bounds}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    report = json.loads(args.report.read_text())
    report['rebake'] = {tier:bake_tier(report,args.report.parent,tier) for tier in ['render','lod']}
    report['geometry'] = 'Body rebuilt from original sculpt at reviewed budgets; mounting meshes and accepted coordinates retained'
    args.report.write_text(json.dumps(report,indent=2)+'\n')
