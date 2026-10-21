"""Blender and packed-GLB matching share the same inverse reference rotation."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree
from medieval_structure import domain,REFERENCE_TREES,reference_key
bpy.ops.wm.read_factory_settings(use_empty=True)
mesh=bpy.data.meshes.new('Reference triangle');mesh.from_pydata([(0,0,0),(1,0,0),(0,1,0)],[],[(0,1,2)]);mesh.update();obj=bpy.data.objects.new('Reference',mesh);bpy.context.collection.objects.link(obj)
ref=dict(code='wall',sourceSHA256='a'*64,rotationZDeg=90,matchMM=.05)
REFERENCE_TREES[reference_key(ref)]=BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get())
part=dict(minMM=[-2,-2,-1],maxMM=[2,2,1],awayFromSource=ref)
assert domain(np.array([[-.2,.2,0],[.2,.2,0],[-.2,.2,.2]]),part).tolist()==[False,True,True]
try:domain(np.array([[0.,0.,0.]]),{**part,'awayFromSource':{**ref,'rotationZDeg':float('nan')}})
except ValueError:pass
else:raise AssertionError('Invalid reference rotation was accepted')
print('ROTATED_SOURCE_REFERENCE_BLENDER_PASS',flush=True)
