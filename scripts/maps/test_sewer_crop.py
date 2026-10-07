"""Blender regression: cutting a shaft must not create a floor across its hole."""
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sewer_crop import crop, clip_mount


def annulus():
    outer = [(-2, -2), (2, -2), (2, 2), (-2, 2)]
    inner = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    vertices = [(x, y, z) for z in [0, 2] for ring in [outer, inner] for x, y in ring]
    faces = []
    for i in range(4):
        j = (i+1) % 4
        faces.extend([(i, j, j+8, i+8), (i+4, i+12, j+12, j+4),
                      (i, i+4, j+4, j), (i+8, j+8, j+12, i+12)])
    mesh = bpy.data.meshes.new('Hollow shaft')
    mesh.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new('Hollow shaft', mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


for mode in ['body', 'mount']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    obj = annulus()
    (crop if mode == 'body' else clip_mount)(obj, 1)
    bpy.context.view_layer.update()
    tree = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
    assert tree.ray_cast(Vector((0, 0, 3)), Vector((0, 0, -1)))[0] is None
    assert tree.ray_cast(Vector((1.5, 0, 3)), Vector((0, 0, -1)))[0] is not None
    plane = 0 if mode == 'body' else 1
    area = sum(p.area for p in obj.data.polygons if all(abs(obj.data.vertices[i].co.z-plane) < 1e-5 for i in p.vertices))
    assert abs(area-12) < 1e-5, (mode, area)
    print('SEWER_CROP_REGRESSION', mode, 'shaft open, cap area', area, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
vertices, faces = [], []
for centre in [-3, 3]:
    offset = len(vertices)
    vertices.extend([(centre+x, y, z) for z in [0, 2] for x, y in [(-1,-1),(1,-1),(1,1),(-1,1)]])
    faces.extend([tuple(offset+i for i in face) for face in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]])
mesh=bpy.data.meshes.new('Separate bridge feet');mesh.from_pydata(vertices,[],faces)
obj=bpy.data.objects.new('Separate bridge feet',mesh);bpy.context.scene.collection.objects.link(obj)
crop(obj,1);bpy.context.view_layer.update()
tree=BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get())
assert tree.ray_cast(Vector((0,0,3)),Vector((0,0,-1)))[0] is None
area=sum(p.area for p in obj.data.polygons if all(abs(obj.data.vertices[i].co.z)<1e-5 for i in p.vertices))
assert abs(area-8)<1e-5, area
print('SEWER_CROP_REGRESSION separate feet, cap area',area,flush=True)
