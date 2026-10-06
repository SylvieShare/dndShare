"""Inspect a supplied STL and render a neutral geometry reference."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
directory = root / "models/objects/chest"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.stl_import(filepath=str(directory / "source.stl"))
obj = bpy.context.object
low = Vector(tuple(min(v.co[a] for v in obj.data.vertices) for a in range(3)))
high = Vector(tuple(max(v.co[a] for v in obj.data.vertices) for a in range(3)))
info = {"triangles": len(obj.data.polygons), "min": list(low), "max": list(high)}
(directory / "source-info.json").write_text(json.dumps(info, indent=2))
print("CHEST_SOURCE", json.dumps(info), flush=True)
centre = (low + high) / 2
scale = .76 / max(high.x - low.x, high.y - low.y)
for vertex in obj.data.vertices:
    vertex.co = Vector(((vertex.co.x - centre.x) * scale,
                        (vertex.co.y - centre.y) * scale,
                        (vertex.co.z - low.z) * scale))
modifier = obj.modifiers.new("Reference budget", "DECIMATE")
modifier.ratio = min(1, 80000 / len(obj.data.polygons))
bpy.ops.object.modifier_apply(modifier=modifier.name)
material = bpy.data.materials.new("Neutral stone")
material.diffuse_color = (.45, .45, .45, 1)
obj.data.materials.append(material)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 16
scene.render.threads_mode = "FIXED"
scene.render.threads = 6
scene.render.resolution_x = scene.render.resolution_y = 768
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.world = bpy.data.worlds.new("Studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .5
lamp = bpy.data.lights.new("Key", "AREA")
lamp.energy, lamp.size = 300, 3
light = bpy.data.objects.new("Key", lamp)
scene.collection.objects.link(light)
light.location = (-2, -3, 4)
light.rotation_euler = (-light.location).to_track_quat("-Z", "Y").to_euler()
camera = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
scene.collection.objects.link(camera)
target = Vector((0, 0, (high.z - low.z) * scale / 2))
camera.location = target + Vector((1.6, -2.4, 1.6))
camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type, camera.data.ortho_scale = "ORTHO", 1.2
scene.camera = camera
scene.render.filepath = str(directory / "reference.png")
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(directory / "reference.blend"))
