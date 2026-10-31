#!/usr/bin/env python3
"""Blender: local, archived art correction; never submits a generation job."""

import argparse, json, sys
from pathlib import Path
import bpy, numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import miniature_scene as scene
from repair_source_art import principled, soften_region, cube_inclusions, gel_volume

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--recipe", type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
args.source, args.output, args.recipe = (
    args.source.resolve(),
    args.output.resolve(),
    args.recipe.resolve(),
)
recipe = json.loads(args.recipe.read_text())
settings = recipe["sourceRepair"]
kind = settings["kind"]
args.output.mkdir(parents=True, exist_ok=True)
# Remove only this stage's old texture outputs before a deliberate rebuild.
for pattern in ["colour-*.png", "orm-*.png"]:
    for file in args.output.glob(pattern):
        file.unlink()
meshes = scene.import_glb(args.source)
assert len(meshes) == 1, "Author the repair for this native single-mesh source"
for mesh in meshes:
    mesh.data.transform(mesh.matrix_world)
    mesh.matrix_world.identity()
obj = meshes[0]
report = {
    "kind": kind,
    "remoteGeneration": False,
    "selectedFaces": 0,
    "bakeDevice": "CPU",
}
if kind == 'pose-cleanup':
    from repair_source_pose import repair_pose
    report.update(repair_pose(obj, settings))
    scene.export_glb(args.output / 'repaired-source.glb')
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output / 'repair.blend'))
    (args.output / 'repair-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print('LOCAL_SOURCE_REPAIR_READY', kind, flush=True)
    raise SystemExit(0)
for mesh in meshes:
    for uv in mesh.data.uv_layers:
        uv.name = "NativeUV"
    for mat in mesh.data.materials:
        for node in mat.node_tree.nodes:
            if node.type == "TEX_IMAGE" and not node.inputs["Vector"].is_linked:
                uv = mat.node_tree.nodes.new("ShaderNodeUVMap")
                uv.uv_map = "NativeUV"
                mat.node_tree.links.new(uv.outputs["UV"], node.inputs["Vector"])
if kind in ["fur", "hair"]:
    report["selectedFaces"] = soften_region(obj, kind, settings)
    report["method"] = "local deformation cage; original topology and UVs retained"
    targets = list(obj.data.materials)
else:
    targets = list(obj.data.materials)
for mat in targets:
    node = principled(mat)
    tree = mat.node_tree
    source = (
        node.inputs["Base Color"].links[0].from_socket
        if node.inputs["Base Color"].is_linked
        else None
    )
    if kind == "ochre":
        hue = tree.nodes.new("ShaderNodeHueSaturation")
        hue.inputs["Hue"].default_value = 0.595
        hue.inputs["Saturation"].default_value = 0.92
        tree.links.new(source, hue.inputs["Color"])
        tree.links.new(hue.outputs["Color"], node.inputs["Base Color"])
    elif kind == "gel":
        noise = tree.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 5
        noise.inputs["Detail"].default_value = 1
        ramp = tree.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (0.008, 0.18, 0.14, 1)
        ramp.color_ramp.elements[1].color = (0.035, 0.49, 0.40, 1)
        tree.links.new(noise.outputs["Fac"], ramp.inputs[0])
        tree.links.new(ramp.outputs[0], node.inputs["Base Color"])
    elif kind in ["fur", "hair"]:
        pass  # Keep the accepted texture while softening the sculpture.
    else:
        colour = {
            "dark-fur": (0.095, 0.105, 0.12),
            "dark-ooze": (0.035, 0.045, 0.075),
        }[kind]
        mix = tree.nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MIX"
        mix.inputs[0].default_value = {
            "dark-fur": 0.2,
            "dark-ooze": 0.2,
        }[kind]
        tree.links.new(source, mix.inputs[1])
        mix.inputs[2].default_value = (*colour, 1)
        tree.links.new(mix.outputs[0], node.inputs["Base Color"])
        if kind in ["dark-fur", "dark-ooze"]:
            grey = tree.nodes.new("ShaderNodeRGBToBW")
            tree.links.new(source, grey.inputs[0])
            threshold = tree.nodes.new("ShaderNodeMath")
            threshold.operation = "LESS_THAN" if kind == "dark-fur" else "GREATER_THAN"
            threshold.inputs[1].default_value = 0.18 if kind == "dark-fur" else 0.01
            tree.links.new(grey.outputs[0], threshold.inputs[0])
            weight = tree.nodes.new("ShaderNodeMath")
            weight.operation = "MULTIPLY"
            weight.inputs[1].default_value = 0.2
            tree.links.new(threshold.outputs[0], weight.inputs[0])
            tree.links.new(weight.outputs[0], mix.inputs[0])
    node.inputs["Metallic"].default_value = 0
    if node.inputs["Metallic"].is_linked:
        tree.links.remove(node.inputs["Metallic"].links[0])
    rough = 0.38 if kind == "gel" else 0.76 if kind == "ochre" else 0.84
    if node.inputs["Roughness"].is_linked:
        tree.links.remove(node.inputs["Roughness"].links[0])
    node.inputs["Roughness"].default_value = rough
if kind == "gel":
    gel_volume(obj, recipe["calibration"]["sourceOrigin"][2])
    meshes += cube_inclusions(obj)
# Keep the accepted body's UVs. Unwrap only newly sculpted volumes.
for o in meshes:
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    if o == obj:
        o.data.uv_layers.active = o.data.uv_layers["NativeUV"]
        continue
    o.data.uv_layers.new(name="AuthoredUV")
    o.data.uv_layers.active = o.data.uv_layers["AuthoredUV"]
    o.data.uv_layers["AuthoredUV"].active_render = True
    print("Unwrapping local volume", o.name, len(o.data.polygons), flush=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(island_margin=0.003)
    bpy.ops.object.mode_set(mode="OBJECT")
context = bpy.context.scene
context.render.engine = "CYCLES"
context.cycles.device = "CPU"
context.cycles.samples = 1
context.render.threads_mode = "FIXED"
context.render.threads = 8
materials = list(dict.fromkeys(m for o in meshes for m in o.data.materials))
for index, mat in enumerate(materials):
    tree = mat.node_tree
    node = principled(mat)
    colour = node.inputs["Base Color"]
    output = next(n for n in tree.nodes if n.type == "OUTPUT_MATERIAL")
    emission = tree.nodes.new("ShaderNodeEmission")
    if colour.is_linked:
        tree.links.new(colour.links[0].from_socket, emission.inputs["Color"])
    else:
        emission.inputs["Color"].default_value = colour.default_value
    rough = node.inputs["Roughness"].default_value
    tree.links.new(emission.outputs[0], output.inputs["Surface"])
    image = bpy.data.images.new(
        "Authored source colour " + str(index),
        width=2048 if mat in targets or mat in obj.data.materials[:] else 512,
        height=2048 if mat in targets or mat in obj.data.materials[:] else 512,
        alpha=False,
    )
    image.colorspace_settings.name = "sRGB"
    texture = tree.nodes.new("ShaderNodeTexImage")
    texture.image = image
    tree.nodes.active = texture
    bpy.ops.object.select_all(action="DESELECT")
    owners = [o for o in meshes if mat in list(o.data.materials)]
    for owner in owners:
        owner.select_set(True)
    bpy.context.view_layer.objects.active = owners[0]
    print("Baking authored colour", index, context.cycles.device, flush=True)
    bpy.ops.object.bake(type="EMIT", use_selected_to_active=False, margin=8)
    image.filepath_raw = str(args.output / f"colour-{index}.png")
    image.file_format = "PNG"
    image.save()
    image.pack()
    tree.nodes.clear()
    shader = tree.nodes.new("ShaderNodeBsdfPrincipled")
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    tex = tree.nodes.new("ShaderNodeTexImage")
    tex.image = image
    uv = tree.nodes.new("ShaderNodeUVMap")
    uv.uv_map = owners[0].data.uv_layers.active.name
    tree.links.new(uv.outputs["UV"], tex.inputs["Vector"])
    tree.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
    tree.links.new(shader.outputs[0], out.inputs["Surface"])
    shader.inputs["Metallic"].default_value = 0
    shader.inputs["Roughness"].default_value = rough
    # Existing high-to-low baker consumes the native ORM texture contract.
    orm = bpy.data.images.new(
        "Authored source ORM " + str(index), width=2, height=2, alpha=False
    )
    orm.colorspace_settings.name = "Non-Color"
    orm.pixels.foreach_set(np.tile(np.array([1, rough, 0, 1], dtype=np.float32), 4))
    orm.filepath_raw = str(args.output / f"orm-{index}.png")
    orm.file_format = "PNG"
    orm.save()
    orm.pack()
    ormtex = tree.nodes.new("ShaderNodeTexImage")
    ormtex.image = orm
    split = tree.nodes.new("ShaderNodeSeparateColor")
    tree.links.new(ormtex.outputs[0], split.inputs[0])
    tree.links.new(split.outputs["Green"], shader.inputs["Roughness"])
# Join after baking so repeated relief parts share four source draw parts.
bpy.ops.object.select_all(action="DESELECT")
for mesh in meshes:
    mesh.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.join()
scene.export_glb(args.output / "repaired-source.glb")
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(args.output / "repair.blend"))
(args.output / "repair-report.json").write_text(json.dumps(report, indent=2) + "\n")
print("LOCAL_SOURCE_REPAIR_READY", kind, flush=True)
