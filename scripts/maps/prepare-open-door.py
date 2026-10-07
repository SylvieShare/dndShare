"""Create one derived open door from a reviewed textured GLB pair."""
import argparse
import json
import sys
from pathlib import Path
import bpy
import bmesh
from array import array
from mathutils import Matrix
sys.path.insert(0, str(Path(__file__).parent))
from importlib.util import spec_from_file_location, module_from_spec
module_spec = spec_from_file_location('open_geometry', Path(__file__).with_name('open-door-geometry.py'))
geometry = module_from_spec(module_spec)
module_spec.loader.exec_module(geometry)


def bake_caps(objects, leaf, directory, tier):
    caps = []
    for obj in list(objects):
        cap_ids = {i for i, m in enumerate(obj.data.materials) if m and m.name.startswith('Recovered')}
        for index in cap_ids:
            mat = obj.data.materials[index]
            cap = obj.copy()
            cap.data = obj.data.copy()
            cap.name = mat.name
            bpy.context.collection.objects.link(cap)
            bm = bmesh.new()
            bm.from_mesh(cap.data)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != index], context='FACES')
            bm.to_mesh(cap.data)
            bm.free()
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index == index], context='FACES')
            bm.to_mesh(obj.data)
            bm.free()
            cap.data.materials.clear()
            cap.data.materials.append(mat)
            for face in cap.data.polygons:
                face.material_index = 0
                face.use_smooth = False
            if obj == leaf:
                cap.parent = leaf
                cap.matrix_parent_inverse = Matrix.Identity(4)
            bpy.ops.object.select_all(action='DESELECT')
            cap.select_set(True)
            bpy.context.view_layer.objects.active = cap
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.uv.smart_project(angle_limit=1.1519, island_margin=.025)
            bpy.ops.object.mode_set(mode='OBJECT')
            nodes, links = mat.node_tree.nodes, mat.node_tree.links
            image = bpy.data.images.new(f'{tier}-{mat.name}', width=512 if tier=='render' else 256, height=512 if tier=='render' else 256, alpha=False)
            image.colorspace_settings.name = 'sRGB'
            image.generated_color = (.13, .11, .08, 1)
            target = nodes.new('ShaderNodeTexImage')
            target.image = image
            nodes.active = target
            bpy.context.scene.render.engine = 'CYCLES'
            bpy.context.scene.cycles.device = 'CPU'
            bpy.context.scene.cycles.samples = 1
            bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_clear=True, margin=12)
            shader = nodes.get('Principled BSDF')
            links.new(target.outputs['Color'], shader.inputs['Base Color'])
            image.filepath_raw = str(directory/(image.name+'.png'))
            image.file_format = 'PNG'
            image.save()
            objects.append(cap)
            caps.append(image.name)
    return caps


def repair_normals(objects):
    repaired = 0
    for obj in objects:
        values = [n.vector.copy() for n in obj.data.corner_normals]
        for face in obj.data.polygons:
            for i in face.loop_indices:
                if values[i].length < .5 or values[i].dot(face.normal) < .05:
                    values[i] = face.normal
                    repaired += 1
        obj.data.normals_split_custom_set(values)
    return repaired


def refresh_ao(objects, directory, tier):
    material = next(m for o in objects for m in o.data.materials if m and m.name.startswith('Dungeon hand-painted'))
    # glTF's packed map is still shared by the frame and leaf. Only R changes.
    orm = next(n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and 'METALLIC' in n.label)
    width, height = orm.size
    image = bpy.data.images.new(tier+'-opened-AO', width=width, height=height, alpha=False, is_data=True)
    image.generated_color = (1, 1, 1, 1)
    target = material.node_tree.nodes.new('ShaderNodeTexImage')
    target.image = image
    material.node_tree.nodes.active = target
    for obj in objects:
        if material not in list(obj.data.materials):
            continue
        # Drop unused cap slots left after separation so every selected slot has a target.
        for i in range(len(obj.data.materials)-1, -1, -1):
            if not any(p.material_index==i for p in obj.data.polygons):
                obj.data.materials.pop(index=i)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.bake(type='AO', use_clear=False, margin=8)
    data = array('f', [0]) * (width*height*4)
    ao = array('f', [0]) * len(data)
    orm.pixels.foreach_get(data)
    image.pixels.foreach_get(ao)
    for i in range(0,len(data),4):
        data[i] = ao[i]
    orm.pixels.foreach_set(data)
    orm.update()
    orm.filepath_raw = str(directory/(tier+'-opened-orm.png'))
    orm.file_format = 'PNG'
    orm.save()
    material.node_tree.nodes.remove(target)


def run(code):
    root = Path(__file__).resolve().parents[2]
    base = root/'models/collections/open-doors'
    spec = json.loads((root/'scripts/maps/open-doors.json').read_text())[code]
    reference = base/'reference'/code
    parent = json.loads((reference/'report.json').read_text())['model']
    directory = base/spec['code']
    directory.mkdir(parents=True, exist_ok=True)
    result = {'parent': parent, 'spec': spec, 'tiers': {}}
    for tier in ['render', 'lod']:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(reference/('preview-model.glb' if tier=='render' else 'lod-preview-model.glb')))
        objects = [obj for obj in bpy.context.scene.objects if obj.type=='MESH']
        body = next(o for o in objects if 'Insertion' not in o.name)
        for obj in objects:
            geometry.apply_object(obj)
        leaf = geometry.separate(body, spec)
        objects.append(leaf)
        caps = bake_caps(objects, leaf, directory, tier)
        for obj in objects:
            obj.data.transform(Matrix.Scale(1/35, 4))
        geometry.open_leaf(leaf, spec)
        bpy.context.view_layer.update()
        repaired = repair_normals(objects)
        refresh_ao(objects, directory, tier)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = body
        bpy.ops.export_scene.gltf(filepath=str(directory/(tier+'-raw.glb')), export_format='GLB', use_selection=True,
                                 export_animations=False, export_cameras=False, export_lights=False, export_tangents=True)
        result['tiers'][tier] = {'triangles': sum(len(o.data.polygons) for o in objects), 'cutAtlases': caps, 'repairedLoopNormals': repaired}
        print('OPEN_DOOR_PREPARED', spec['code'], tier, result['tiers'][tier], flush=True)
    (directory/'geometry-report.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('code', choices=['UD-010','UD-011'])
    run(parser.parse_args(sys.argv[sys.argv.index('--')+1:]).code)
