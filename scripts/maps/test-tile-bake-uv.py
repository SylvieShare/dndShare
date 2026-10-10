"""Reject collapsed SmartUV even when neutral image pixels are nonblack."""
import sys
from pathlib import Path
import bpy

sys.path.insert(0, str(Path(__file__).parent))
import tile_bake

bpy.ops.wm.read_factory_settings(use_empty=True)
mesh = bpy.data.meshes.new('UV regression triangle')
mesh.from_pydata([(0,0,0),(1,0,0),(0,1,0)], [], [(0,1,2)])
mesh.update()
obj = bpy.data.objects.new('UV regression triangle',mesh)
bpy.context.collection.objects.link(obj)
uv = mesh.uv_layers.new()
for loop in uv.data: loop.uv = (.5,.5)
tile_bake.SIZE = 16
for name,colour,data in [('Colour',(.2,.3,.4,1),False),('Normal',(.5,.5,1,1),True)]:
    image = bpy.data.images.new(name,width=16,height=16,alpha=False,is_data=data)
    image.generated_color = colour
try:
    tile_bake.validate_maps(obj)
except RuntimeError as error:
    assert 'UV packing collapsed' in str(error)
else:
    raise AssertionError('Collapsed UV incorrectly passed neutral-image QA')
for loop,point in zip(uv.data,[(.1,.1),(.9,.1),(.1,.9)]): loop.uv = point
result = tile_bake.validate_maps(obj)
assert result['uvMappedTriangles']==1 and result['blackTriangleCentres']==0
print('TILE_BAKE_UV_REGRESSION_VERIFIED',result,flush=True)
