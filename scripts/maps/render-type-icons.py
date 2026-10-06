"""Render deterministic, opaque tile silhouettes for the editor's WebP filters."""
import argparse
from pathlib import Path
import sys

import bpy
from mathutils import Vector


KINDS = ["floor", "wall-straight", "wall-angle", "wall-tee", "wall-cross",
         "wall-end", "wall-corner", "wall-diagonal", "stairs", "frame", "prop",
         "wall-mode-none", "wall-mode-center", "wall-mode-edge", "bridge", "passage", "column"]


def material(name, color):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1)
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = .78
    return value


def box(name, position, size, mat, rotation=0, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    obj.rotation_euler.z = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Soft stone edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        obj.modifiers.new("Face normals", "WEIGHTED_NORMAL")
    return obj


def masonry_material():
    value = material("Masonry", (.43, .39, .32))
    nodes, links = value.node_tree.nodes, value.node_tree.links
    brick = nodes.new("ShaderNodeTexBrick")
    brick.inputs["Scale"].default_value = 1
    brick.inputs["Brick Width"].default_value = .43
    brick.inputs["Row Height"].default_value = .31
    brick.inputs["Mortar Size"].default_value = .009
    brick.inputs["Color1"].default_value = (.43, .39, .32, 1)
    brick.inputs["Color2"].default_value = (.50, .46, .39, 1)
    brick.inputs["Mortar"].default_value = (.22, .20, .17, 1)
    uv = nodes.new("ShaderNodeTexCoord")
    links.new(uv.outputs["UV"], brick.inputs["Vector"])
    links.new(brick.outputs["Color"], nodes.get("Principled BSDF").inputs["Base Color"])
    return value


def wall(polygon):
    count = len(polygon)
    vertices = [(x, y, z) for z in [.22, 1.17] for x, y in polygon]
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    mesh = bpy.data.meshes.new("Continuous wall")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Masonry", mesh)
    bpy.context.scene.collection.objects.link(obj)
    mesh.materials.append(masonry_material())
    uv = mesh.uv_layers.new(name="Brick coordinates")
    for face in mesh.polygons:
        origin = Vector(vertices[mesh.loops[face.loop_start].vertex_index])
        direction = Vector(vertices[mesh.loops[face.loop_start + 1].vertex_index]) - origin
        direction.z = 0
        if direction.length:
            direction.normalize()
        for index in face.loop_indices:
            p = Vector(vertices[mesh.loops[index].vertex_index])
            uv.data[index].uv = (p.x, p.y) if face.index < 2 else ((p - origin).dot(direction), p.z - .22)
    modifier = obj.modifiers.new("Soft silhouette", "BEVEL")
    modifier.width, modifier.segments = .018, 2
    obj.modifiers.new("Face normals", "WEIGHTED_NORMAL")


def tile(kind):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    stone = [material(f"Limestone {i}", (.41 + i * .025, .37 + i * .024, .29 + i * .022))
             for i in range(5)]
    joint = material("Stone edges", (.19, .17, .135))
    wood = material("Warm oak", (.34, .19, .075))
    iron = material("Forged iron", (.12, .14, .15))
    box("Tile body", (0, 0, .08), (2, 2, .16), joint, bevel=.055)
    for x in range(2):
        for y in range(2):
            box("Paving", (x - .5, y - .5, .17), (.98, .98, .12), stone[(x + y * 2) % 5], bevel=.018)
    footprints = {
        "wall-straight": [(-.83, -.14), (.83, -.14), (.83, .14), (-.83, .14)],
        "wall-angle": [(-.87, -.8), (-.59, -.8), (-.59, .59), (.8, .59), (.8, .87), (-.87, .87)],
        "wall-tee": [(-.83, .31), (-.14, .31), (-.14, -.83), (.14, -.83), (.14, .31), (.83, .31), (.83, .59), (-.83, .59)],
        "wall-cross": [(-.83, -.14), (-.14, -.14), (-.14, -.83), (.14, -.83), (.14, -.14), (.83, -.14), (.83, .14), (.14, .14), (.14, .83), (-.14, .83), (-.14, .14), (-.83, .14)],
        "wall-end": [(-.14, -.1), (.14, -.1), (.14, .83), (-.14, .83)],
        "wall-diagonal": [(-.84, -.64), (-.64, -.84), (.84, .64), (.64, .84)],
    }
    if kind in footprints:
        wall(footprints[kind])
    if kind == "wall-mode-center":
        wall(footprints["wall-straight"])
        violet = material("Connection points", (.55, .32, .85))
        for x, y in [(0, -.85), (.85, -.85), (.85, 0), (.85, .85),
                     (0, .85), (-.85, .85), (-.85, 0), (-.85, -.85)]:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=.09, location=(x, y, 1.36))
            bpy.context.object.data.materials.append(violet)
            bpy.ops.object.shade_smooth()
    if kind == "wall-mode-edge":
        wall(footprints["wall-angle"])
        violet = material("Connection sides", (.55, .32, .85))
        for x in [-.88, .88]:
            box("Side", (x, 0, 1.36), (.12, 1.5, .16), violet)
        for y in [-.88, .88]:
            box("Side", (0, y, 1.36), (1.5, .12, .16), violet)
    if kind == "wall-corner":
        # UD-096 is a column at the outside corner, rather than an L-shaped wall.
        for course in range(4):
            box("Outside corner", (.73, .73, .35 + course * .27),
                (.43, .43, .26), stone[course], bevel=.025)
    if kind == "bridge":
        for x in [-.74, .74]:
            box("Stone abutment", (x, 0, .5), (.35, 1.2, .55), stone[2])
        for x in range(7):
            box("Bridge plank", (-.75+x*.25, 0, .85), (.23, 1.2, .15), wood)
    if kind == "passage":
        for x in [-.68, .68]:
            box("Door jamb", (x, 0, .75), (.33, .35, 1.04), stone[2])
        box("Lintel", (0, 0, 1.26), (1.7, .35, .25), stone[3])
    if kind == "column":
        box("Column base", (0, 0, .33), (.8, .8, .22), stone[3])
        for row in range(4):
            box("Column course", (0, 0, .53+row*.22), (.48, .48, .2), stone[row])
        box("Capital", (0, 0, 1.37), (.7, .7, .18), stone[2])
    if kind == "stairs":
        for step in range(4):
            height = .22 * (step + 1)
            box("Step", (0, -.69 + step * .46, .23 + height / 2),
                (1.65, .44, height), stone[step], bevel=.025)
    if kind == "frame":
        for x in [-.74, .74]:
            for y in [-.74, .74]:
                box("Socket support", (x, y, .81), (.24, .24, 1.16), stone[2])
        for x in [-.74, .74]:
            box("Top rim", (x, 0, 1.39), (.3, 1.18, .2), stone[3])
        for y in [-.74, .74]:
            box("Top rim", (0, y, 1.39), (1.8, .3, .2), stone[3])
    if kind == "prop":
        box("Chest", (0, 0, .58), (1.27, .87, .7), wood, bevel=.065)
        box("Lid", (0, 0, .98), (1.35, .95, .18), wood, bevel=.045)
        for x in [-.42, .42]:
            box("Iron strap", (x, -.447, .62), (.09, .025, .68), iron, bevel=.005)
            box("Lid strap", (x, 0, 1.08), (.09, .95, .025), iron, bevel=.005)
        box("Lock", (0, -.47, .79), (.17, .04, .22), iron, bevel=.01)


def render(kind, output):
    tile(kind)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 40
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 384
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "AgX"
    scene.world = bpy.data.worlds.new("Studio")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .4
    for name, energy, position, size in [("Key", 500, (-3, -4, 6), 4),
                                        ("Fill", 250, (4, -1, 4), 3),
                                        ("Rim", 350, (0, 4, 5), 3)]:
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.size = energy, size
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.location = position
        obj.rotation_euler = (-Vector(position)).to_track_quat("-Z", "Y").to_euler()
    camera = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    scene.collection.objects.link(camera)
    camera.location = (3.5, -5, 4.6)
    camera.rotation_euler = (Vector((0, 0, .54)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type, camera.data.ortho_scale = "ORTHO", 3.05
    scene.camera = camera
    scene.render.filepath = str(output / f"{kind}.png")
    bpy.ops.render.render(write_still=True)
    print("TILE_ICON", kind, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--kinds", nargs="+", choices=KINDS, default=KINDS)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    args.output.mkdir(parents=True, exist_ok=True)
    for kind in args.kinds:
        render(kind, args.output)
