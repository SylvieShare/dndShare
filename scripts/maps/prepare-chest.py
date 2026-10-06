"""Bake sculpt detail and oak/iron/brass finishes into a browser-sized chest."""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
out = root / "models/objects/chest"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.stl_import(filepath=str(out / "source.stl"))
source = bpy.context.object
low = Vector(tuple(min(v.co[a] for v in source.data.vertices) for a in range(3)))
high = Vector(tuple(max(v.co[a] for v in source.data.vertices) for a in range(3)))
centre = (low + high) / 2
scale = .76 / max(high.x - low.x, high.y - low.y)
for v in source.data.vertices:
    v.co = Vector(((v.co.x - centre.x) * scale, (v.co.y - centre.y) * scale, (v.co.z - low.z) * scale))
source.data.update()
height = (high.z - low.z) * scale


def finish(name, dark, light, grain, roughness, metallic):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    coord = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeVectorMath"); mapping.operation = "MULTIPLY"
    mapping.inputs[1].default_value = grain
    links.new(coord.outputs["Object"], mapping.inputs[0])
    noise = nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 1
    noise.inputs["Detail"].default_value = 4; noise.inputs["Roughness"].default_value = .7
    links.new(mapping.outputs[0], noise.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color, ramp.color_ramp.elements[1].color = (*dark, 1), (*light, 1)
    links.new(noise.outputs["Fac"], ramp.inputs[0])
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    return mat, ramp, roughness, metallic


finishes = [
    finish("Aged oak", (.065, .021, .006), (.35, .16, .037), (10, 220, 180), .78, 0),
    finish("Dark forged iron", (.026, .033, .037), (.12, .14, .15), (90, 90, 90), .46, .92),
    finish("Worn brass lock", (.19, .09, .022), (.46, .29, .08), (100, 100, 100), .38, .86),
]
for material, *_ in finishes: source.data.materials.append(material)
for face in source.data.polygons:
    x, y, z = face.center
    # Raised straps encircle the lid; end-grain panels stay oak.
    strap = abs(x) < .048 or (.265 < abs(x) < .345 and abs(face.normal.x) < .84)
    frame = z < .047 or (.26 < z < .295 and abs(face.normal.z) < .65)
    lock = abs(x) < .064 and y < -.22 and .16 < z < .36
    face.material_index = 2 if lock else 1 if strap or frame else 0
    face.use_smooth = True

target = bpy.data.objects.new("Dungeon chest", source.data.copy())
bpy.context.collection.objects.link(target)
source.select_set(False); target.select_set(True); bpy.context.view_layer.objects.active = target
decimate = target.modifiers.new("Browser geometry", "DECIMATE")
decimate.ratio = 95000 / len(target.data.polygons); decimate.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=decimate.name)
target.data.materials.clear()
material = bpy.data.materials.new("Chest PBR atlas"); material.use_nodes = True
target.data.materials.append(material)
for face in target.data.polygons: face.material_index = 0; face.use_smooth = True
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.uv.smart_project(angle_limit=1.1519, island_margin=.015)
bpy.ops.object.mode_set(mode="OBJECT")
scene = bpy.context.scene
scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"; scene.cycles.samples = 16
scene.render.threads_mode = "FIXED"; scene.render.threads = 6


def bake(name, kind):
    image = bpy.data.images.new(name, width=1024, height=1024, alpha=False, is_data=name != "colour")
    image.colorspace_settings.name = "sRGB" if name == "colour" else "Non-Color"
    image.generated_color = (.5, .5, 1, 1) if kind == "NORMAL" else (0, 0, 0, 1)
    node = material.node_tree.nodes.new("ShaderNodeTexImage"); node.image = image
    material.node_tree.nodes.active = node
    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True); target.select_set(True); bpy.context.view_layer.objects.active = target
    bpy.ops.object.bake(type=kind, use_selected_to_active=True, cage_extrusion=.035, max_ray_distance=.09, margin=16)
    image.filepath_raw = str(out / f"{name}.png"); image.file_format = "PNG"; image.save()
    return node


normal = bake("normal", "NORMAL")
# Colour directly on the reduced surface: projection onto intersecting sculpt
# shells can otherwise place tiny iron/black texels into the oak panels.
source.hide_render = True; source.hide_viewport = True
surface_materials = []
colour_image = bpy.data.images.new("colour", width=1024, height=1024, alpha=False)
colour_image.colorspace_settings.name = "sRGB"
target.data.materials.clear()
for original, _, roughness, metallic in finishes:
    mat = original.copy()
    mat.name = original.name + " baked"
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    ramp = next(n for n in nodes if n.type == "VALTORGB")
    emit = nodes.new("ShaderNodeEmission")
    links.new(ramp.outputs["Color"], emit.inputs["Color"])
    links.new(emit.outputs[0], nodes.get("Material Output").inputs["Surface"])
    image_node = nodes.new("ShaderNodeTexImage"); image_node.image = colour_image; nodes.active = image_node
    target.data.materials.append(mat)
    surface_materials.append((mat, roughness, metallic))
for face in target.data.polygons:
    x,y,z = face.center
    strap = abs(x)<.048 or (.265<abs(x)<.345 and abs(face.normal.x)<.84)
    frame = z<.047 or (.26<z<.295 and abs(face.normal.z)<.65)
    lock = abs(x)<.064 and y<-.22 and .16<z<.36
    face.material_index = 2 if lock else 1 if strap or frame else 0
bpy.ops.object.select_all(action="DESELECT"); target.select_set(True); bpy.context.view_layer.objects.active=target
bpy.ops.object.bake(type="EMIT", use_selected_to_active=False, margin=16)
colour_image.filepath_raw=str(out/"colour.png"); colour_image.file_format="PNG"; colour_image.save()
for mat, roughness, metallic in surface_materials:
    nodes,links = mat.node_tree.nodes,mat.node_tree.links
    shader=nodes.get("Principled BSDF")
    links.new(shader.outputs[0],nodes.get("Material Output").inputs["Surface"])
    colour=next(n for n in nodes if n.type=="TEX_IMAGE" and n.image==colour_image)
    links.new(colour.outputs["Color"],shader.inputs["Base Color"])
    shader.inputs["Roughness"].default_value=roughness;shader.inputs["Metallic"].default_value=metallic
    tex=nodes.new("ShaderNodeTexImage");tex.image=normal.image
    normal_map=nodes.new("ShaderNodeNormalMap");normal_map.inputs["Strength"].default_value=.7
    links.new(tex.outputs["Color"],normal_map.inputs["Color"]);links.new(normal_map.outputs[0],shader.inputs["Normal"])
bpy.ops.object.select_all(action="DESELECT"); target.select_set(True); bpy.context.view_layer.objects.active = target
bpy.ops.export_scene.gltf(filepath=str(out / "render.glb"), export_format="GLB", use_selection=True, export_tangents=True, export_animations=False)
render_count = len(target.data.polygons)
lod = target.modifiers.new("Distant geometry", "DECIMATE"); lod.ratio = .22
bpy.ops.object.modifier_apply(modifier=lod.name)
bpy.ops.export_scene.gltf(filepath=str(out / "lod.glb"), export_format="GLB", use_selection=True, export_tangents=True, export_animations=False)
(out / "prepared-info.json").write_text(json.dumps({"height": height, "renderTriangles": render_count, "lodTriangles": len(target.data.polygons)}, indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out / "painted.blend"))
print("CHEST_PREPARED", render_count, len(target.data.polygons), flush=True)
