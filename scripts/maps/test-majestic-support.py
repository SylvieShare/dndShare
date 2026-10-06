"""A point below an arch must use the floor, never the underside of its beam."""
import importlib.util
from pathlib import Path
import bpy

path=Path(__file__).with_name('prepare-majestic.py')
spec=importlib.util.spec_from_file_location('prepare_majestics',path)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
bpy.ops.wm.read_factory_settings(use_empty=True)
verts=[(-4,-4,15),(4,-4,15),(4,4,15),(-4,4,15),
       (-4,-4,20),(4,-4,20),(4,4,20),(-4,4,20),
       (-4,-4,30),(4,-4,30),(4,4,30),(-4,4,30)]
faces=[(0,1,2,3),(4,7,6,5),(8,9,10,11),(4,5,9,8),(5,6,10,9),(6,7,11,10),(7,4,8,11)]
mesh=bpy.data.meshes.new('Ground and arch');mesh.from_pydata(verts,[],faces);mesh.update()
obj=bpy.data.objects.new('Ground and arch',mesh);bpy.context.collection.objects.link(obj)
recipe={'width':1,'height':1,'standMaxZMM':25}
points=module.support_points(obj,[0,0],recipe,9.75)
assert abs(points[0]['elevation']-15/35)<.000001,points
# The absence of a floor must be a review failure, not a support at the cut.
mesh.clear_geometry();mesh.from_pydata(verts[4:],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]);mesh.update()
try:module.support_points(obj,[0,0],recipe,9.75)
except ValueError:pass
else:raise AssertionError('Missing ground accepted')
print('MAJESTIC_SUPPORT_TEST_PASSED',flush=True)
