import bpy
from pathlib import Path
from mathutils import Vector
root = Path(__file__).resolve().parents[2] / "models/objects/chest"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root / "render.glb"))
scene = bpy.context.scene
scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"; scene.cycles.samples = 32
scene.render.threads_mode = "FIXED"; scene.render.threads = 6
scene.render.resolution_x = scene.render.resolution_y = 768; scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"; scene.render.image_settings.color_mode = "RGBA"; scene.render.film_transparent = True
scene.world = bpy.data.worlds.new("Studio"); scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .7
for name, location, energy in [('Key',(-2,-3,4),250),('Fill',(2,1,3),180)]:
 light = bpy.data.lights.new(name,'AREA'); light.energy=energy; light.size=3
 obj=bpy.data.objects.new(name,light); scene.collection.objects.link(obj); obj.location=location
 obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));scene.collection.objects.link(camera)
target=Vector((0,0,.26));camera.location=target+Vector((1.6,-2.4,1.6))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=1.1;scene.camera=camera
scene.render.filepath=str(root/'preview.png');bpy.ops.render.render(write_still=True)
