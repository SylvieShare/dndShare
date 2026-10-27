"""Bounded local sculpture edits in native Blender coordinates."""

import math
import bpy
import numpy as np
from mathutils import Vector


def principled(material):
    return next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def soften_region(obj, kind, settings):
    """Use a coarse volume as a deformation cage; preserve the body's topology/UVs."""
    from mathutils.bvhtree import BVHTree

    vertices = np.array([tuple(v.co) for v in obj.data.vertices])
    rear = settings.get("rearMin", 0.08 if kind == "fur" else 0.015)
    bottom = settings.get("minimumZ", -0.27 if kind == "fur" else 0.04)
    top = settings.get("maximumZ", 0.49 if kind == "fur" else 1)
    selected = (
        (vertices[:, 1] > rear) & (vertices[:, 2] > bottom) & (vertices[:, 2] < top)
    )
    faces = np.array(
        [
            tuple(p.vertices)
            for p in obj.data.polygons
            if all(selected[v] for v in p.vertices)
        ]
    )
    if not len(faces):
        raise ValueError("Authored surface region selected no faces")
    used, indices = np.unique(faces, return_inverse=True)
    data = bpy.data.meshes.new("Temporary coarse cage")
    data.from_pydata(vertices[used].tolist(), [], indices.reshape(faces.shape).tolist())
    part = bpy.data.objects.new("Temporary coarse cage", data)
    bpy.context.collection.objects.link(part)
    bpy.ops.object.select_all(action="DESELECT")
    part.select_set(True)
    bpy.context.view_layer.objects.active = part
    modifier = part.modifiers.new("Coarse connected volume", "REMESH")
    modifier.mode = "VOXEL"
    modifier.voxel_size = settings["voxelSize"]
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier = part.modifiers.new("Round coarse clumps", "SMOOTH")
    modifier.factor = 0.35
    modifier.iterations = 2
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    tree = BVHTree.FromObject(part, bpy.context.evaluated_depsgraph_get())
    changed = 0
    for index in np.flatnonzero(selected):
        vertex = obj.data.vertices[int(index)]
        point = vertex.co
        weight = min(
            1,
            (point.y - rear) / 0.04,
            (point.z - bottom) / 0.04,
            (top - point.z) / 0.04,
        )
        nearest = tree.find_nearest(point)
        if nearest[0] is not None and nearest[3] < 0.06:
            vertex.co = point.lerp(nearest[0], max(0, weight) * 0.95)
            changed += 1
    bpy.data.objects.remove(part, do_unlink=True)
    # Recompute deformed normals; keep untouched parts' imported split normals.
    normals = [tuple(n.vector) for n in obj.data.corner_normals]
    for loop in obj.data.loops:
        if selected[loop.vertex_index]:
            normals[loop.index] = (0, 0, 0)
    obj.data.normals_split_custom_set(normals)
    obj.data.update()
    print(
        "Locally deformed vertices",
        kind,
        changed,
        "selected faces",
        len(faces),
        flush=True,
    )
    return len(faces)


def solid_material(name, colour, roughness=0.8):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    node = principled(material)
    node.inputs["Base Color"].default_value = (*colour, 1)
    node.inputs["Roughness"].default_value = roughness
    node.inputs["Metallic"].default_value = 0
    return material


def gel_volume(obj, origin):
    """Replace the cracked ice shell with one continuous, softly rounded volume."""
    points = np.array([tuple(v.co) for v in obj.data.vertices])
    low, high = points.min(axis=0), points.max(axis=0)
    bpy.ops.mesh.primitive_cube_add(location=(low + high) / 2)
    volume = bpy.context.object
    volume.scale = (high - low) / 2
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = volume.modifiers.new("Soft gel corners", "BEVEL")
    bevel.width = float(min(high - low)) * 0.08
    bevel.segments = 5
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    subdivide = volume.modifiers.new("Even surface for broad ripples", "SUBSURF")
    subdivide.subdivision_type = "SIMPLE"
    subdivide.levels = 2
    bpy.ops.object.modifier_apply(modifier=subdivide.name)
    texture = bpy.data.textures.new("Broad gel ripples", type="CLOUDS")
    texture.noise_scale = float(min(high - low)) * 0.22
    displace = volume.modifiers.new("Slightly uneven gel surface", "DISPLACE")
    displace.texture = texture
    displace.strength = float(min(high - low)) * 0.016
    bpy.ops.object.modifier_apply(modifier=displace.name)
    data = volume.data.copy()
    data.transform(volume.matrix_world)
    minimum = min(v.co.z for v in data.vertices)
    for vertex in data.vertices:
        vertex.co.z += origin - minimum
    for face in data.polygons:
        face.use_smooth = True
    data.uv_layers[0].name = "NativeUV"
    for material in obj.data.materials:
        data.materials.append(material)
    obj.data = data
    bpy.data.objects.remove(volume, do_unlink=True)


def cube_inclusions(obj):
    """Partly buried painted reliefs make the gel's contents readable at map scale."""
    from mathutils.bvhtree import BVHTree

    tree = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
    v = np.array([tuple(x.co) for x in obj.data.vertices])
    low, high = v.min(axis=0), v.max(axis=0)
    width = high[0] - low[0]
    height = high[2] - low[2]
    bone = solid_material("Contents under cyan gel", (0.18, 0.38, 0.30))
    dark = solid_material("Deep gel cavities", (0.015, 0.085, 0.075))
    iron = solid_material("Swallowed corroded iron", (0.07, 0.18, 0.17))
    made = []

    def front(x, z):
        hit = tree.ray_cast(Vector((x, low[1] - width, z)), Vector((0, 1, 0)))[0]
        return hit.y if hit else low[1]

    def sphere(name, x, z, scale, material, depth=0.006):
        y = front(x, z) - depth
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=16, ring_count=8, location=(x, y, z)
        )
        p = bpy.context.object
        p.name = name
        p.scale = scale
        p.data.materials.append(material)
        made.append(p)
        return p

    cx = (low[0] + high[0]) / 2
    cz = (low[2] + high[2]) / 2
    sx = cx - width * 0.17
    sz = cz + height * 0.20
    sphere(
        "Swallowed skull",
        sx,
        sz,
        (width * 0.09, width * 0.045, height * 0.105),
        bone,
        -width * 0.02,
    )
    for sign in [-1, 1]:
        sphere(
            "Skull socket",
            sx + sign * width * 0.033,
            sz + height * 0.012,
            (width * 0.022, width * 0.012, height * 0.026),
            dark,
            width * 0.021,
        )
    sphere(
        "Skull nose",
        sx,
        sz - height * 0.022,
        (width * 0.012, width * 0.011, height * 0.021),
        dark,
        width * 0.021,
    )
    sphere(
        "Swallowed jaw",
        sx,
        sz - height * 0.088,
        (width * 0.068, width * 0.018, height * 0.025),
        bone,
        width * 0.005,
    )
    for i in range(5):
        sphere(
            "Blunt skull tooth",
            sx + (i - 2) * width * 0.018,
            sz - height * 0.065,
            (width * 0.008, width * 0.013, height * 0.021),
            bone,
            width * 0.010,
        )

    def tube(name, points, radius, material):
        data = bpy.data.curves.new(name, "CURVE")
        data.dimensions = "3D"
        data.resolution_u = 4
        data.bevel_depth = radius
        data.bevel_resolution = 2
        spline = data.splines.new("BEZIER")
        spline.bezier_points.add(len(points) - 1)
        for point, (x, z) in zip(spline.bezier_points, points):
            point.co = (x, front(x, z) + width * 0.004, z)
            point.handle_left_type = point.handle_right_type = "AUTO"
        p = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(p)
        p.data.materials.append(material)
        made.append(p)

    rx = cx - width * 0.10
    rz = cz - height * 0.10
    tube(
        "Swallowed spine",
        [(rx, rz - height * 0.15), (rx, rz + height * 0.15)],
        width * 0.011,
        bone,
    )
    for i in range(4):
        z = rz + (i - 1.5) * height * 0.065
        for sign in [-1, 1]:
            tube(
                "Rounded swallowed rib",
                [
                    (rx, z),
                    (rx + sign * width * 0.08, z - height * 0.015),
                    (rx + sign * width * 0.14, z + height * 0.015),
                ],
                width * 0.012,
                bone,
            )
    tube(
        "Swallowed blade",
        [
            (cx + width * 0.06, cz - height * 0.27),
            (cx + width * 0.30, cz + height * 0.19),
        ],
        width * 0.022,
        iron,
    )
    tube(
        "Swallowed sword guard",
        [
            (cx + width * 0.19, cz + height * 0.025),
            (cx + width * 0.32, cz - height * 0.045),
        ],
        width * 0.014,
        iron,
    )
    for p in made:
        if p.type == "CURVE":
            bpy.ops.object.select_all(action="DESELECT")
            p.select_set(True)
            bpy.context.view_layer.objects.active = p
            bpy.ops.object.convert(target="MESH")
    return made
