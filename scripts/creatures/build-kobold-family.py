"""Blender: derive equipped miniatures from the accepted, textured kobold base."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
import bpy
import bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import miniature_scene as scene
from kobold_equipment import Equipment
from bake_equipment import bake_equipment


def remove_weapon(obj, anchors, replace_hand=False):
    root, tip, grip = (Vector(anchors[k]) for k in ['blade-root', 'blade-tip', 'grip'])
    axis = (tip - root).normalized()
    length = (tip - root).length
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    cut = []
    for face in bm.faces:
        p = obj.matrix_world @ face.calc_center_median()
        offset = p - root
        t = offset.dot(axis) / length
        radial = (offset - axis * offset.dot(axis)).length
        pommel = Vector(anchors['pommel'])
        back_axis = (pommel-grip).normalized()
        back_t = (p-grip).dot(back_axis)
        back_radial = ((p-grip)-back_axis*back_t).length
        remove = (-1.45 < t < 1.2 and radial < .07) or (0 < back_t < (pommel-grip).length + .04 and back_radial < .042)
        if (remove and (p - grip).length > .064) or (replace_hand and (p-grip).length < .071):
            cut.append(face)
    if cut:
        bmesh.ops.delete(bm, geom=cut, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return len(cut)


def recolour(obj, kind, folder, role):
    if kind not in {'underling', 'vampire'}:
        return
    for material in obj.data.materials:
        if not material or not material.use_nodes:
            continue
        shader = material.node_tree.nodes.get('Principled BSDF')
        linked = shader.inputs['Base Color'].links
        if not linked or linked[0].from_node.type != 'TEX_IMAGE':
            continue
        node = linked[0].from_node
        image = node.image.copy()
        data = np.empty(len(image.pixels), dtype=np.float32)
        image.pixels.foreach_get(data)
        rgba = data.reshape(-1, 4)
        # Byte-backed Blender images expose their encoded colour channels here.
        rgb = np.clip(rgba[:, :3], 0, 1)
        r, g, b = rgb.T
        skin = (r > g * 1.55) & (g > b * 1.18) & (r > .25)
        plates = (r > g * .94) & (r < g * 1.4) & (g > b * 1.2) & (r > .55)
        changed = rgb.copy()
        if kind == 'vampire':
            warm = (r > g * 1.1) & (g > b * 1.1) & (r > .15)
            light = r * .3 + g * .5 + b * .2
            changed[warm] = np.array([.39, .43, .46]) * (light[warm] / .50)[:, None]
            changed[plates] = np.array([.64, .65, .61]) * (r[plates] / .85)[:, None]
        if kind == 'underling':
            changed[skin] = np.array([.65, .28, .12]) * (r[skin] / .8)[:, None]
        rgba[:, :3] = np.clip(changed, 0, 1)
        image.pixels.foreach_set(data)
        image.filepath_raw = str(folder / f'{role}-body-albedo.png')
        image.file_format = 'PNG'
        image.save()
        node.image = image


def consolidate():
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = max(meshes, key=lambda o: len(o.data.polygons))
    bpy.ops.object.join()
    bpy.context.view_layer.update()


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
parser.add_argument('--base', type=Path)
parser.add_argument('--only', default='')
parser.add_argument('--quick', action='store_true')
parser.add_argument('--roles', default='render,lod,source,shadow')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = args.directory.resolve()
base = (args.base or out.parent / 'kobold-1635-v2').resolve()
recipes = json.loads(Path(__file__).with_name('kobold-family.json').read_text())
anchors = json.loads(Path(__file__).with_name('kobold-landmarks.json').read_text())
chosen = set(args.only.split(',')) if args.only else None
for recipe in recipes:
    kind = recipe['slug']
    if kind == 'guard-1672' or (chosen and kind not in chosen):
        continue
    folder = out / kind
    folder.mkdir(parents=True, exist_ok=True)
    if (folder / 'recipe.json').exists():
        recipe.update({k:v for k,v in json.loads((folder/'recipe.json').read_text()).items() if k == 'maxHeight'})
    roles = set(args.roles.split(','))
    details = []
    if (folder/'creation.json').exists():
        details = [d for d in json.loads((folder/'creation.json').read_text())['roles'] if d['role'] not in roles]
    for role, filename in [('render', 'kobold-1635.glb'), ('lod', 'kobold-1635-lod.glb'),
                           ('source', 'kobold-1635-master.glb'), ('shadow','kobold-1635-shadow.glb')]:
        if role not in roles:
            continue
        if args.quick and role != 'render':
            continue
        meshes = scene.import_glb(base / filename)
        body = max(meshes, key=lambda obj: len(obj.data.polygons))
        removed = 0
        if kind in {'underling', 'dragonshield', 'sorcerer', 'vampire'}:
            removed = remove_weapon(body, anchors, replace_hand=kind=='vampire')
        recolour(body, kind, folder, role)
        surface = BVHTree.FromPolygons([body.matrix_world@v.co for v in body.data.vertices],
            [list(p.vertices) for p in body.data.polygons])
        equipment = Equipment(anchors, lod=role in {'lod','shadow'}, surface=surface)
        equipment.build(kind)
        if role != 'shadow':
            bake_equipment(equipment.g.objects, body, folder, role)
        if kind in {'icewind', 'vampire'}:
            for obj in meshes:
                if 'top' in obj.name.lower():
                    obj.data.materials.clear()
                    obj.data.materials.append(equipment.g.material('Cold slate base', (.24, .29, .31), .97))
        consolidate()
        target = 'model.glb' if role == 'render' else f'model-{role}.glb'
        scene.export_glb(folder / target, shadow=role == 'shadow')
        values = scene.points([o for o in bpy.context.scene.objects if o.type == 'MESH'])
        high = max(p.z for p in values)
        details.append({'role': role, 'removedWeaponFaces': removed,
            'vertices': sum(len(o.data.vertices) for o in bpy.context.scene.objects if o.type == 'MESH'),
            'maxHeight': high})
        if role == 'render':
            bpy.ops.file.pack_all()
            bpy.ops.wm.save_as_mainfile(filepath=str(folder / 'model.blend'))
            scene.render(folder, [('preview', 254, 25)] if args.quick else None)
            recipe['maxHeight'] = round(high + .002, 4)
        elif role == 'lod':
            scene.render(folder, [('lod-preview', 254, 25), ('lod-top', 254, 78)])
    (folder / 'recipe.json').write_text(json.dumps(recipe, ensure_ascii=False, indent=2) + '\n')
    provenance = {'method': 'Accepted native kobold base with fitted, scripted equipment',
        'sourceItemId': 1635, 'itemIds': recipe['itemIds'], 'roles': details,
        'baseSHA256': hashlib.sha256((base / 'kobold-1635.glb').read_bytes()).hexdigest()}
    (folder / 'creation.json').write_text(json.dumps(provenance, indent=2) + '\n')
    print('Finished variant', kind, flush=True)
