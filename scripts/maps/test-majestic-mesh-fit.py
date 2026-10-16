"""Surface crossing and complete containment must both reject a mount."""
import importlib.util
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
s=importlib.util.spec_from_file_location('fit',Path(__file__).with_name('validate-majestic-mesh-fit.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def cube(half,shift=(0,0,0)):
 v=[Vector((x+shift[0],y+shift[1],z+shift[2]))for x,y,z in [(-half,-half,-half),(half,-half,-half),(half,half,-half),(-half,half,-half),(-half,-half,half),(half,-half,half),(half,half,half),(-half,half,half)]]
 f=[(0,2,1),(0,3,2),(4,5,6),(4,6,7),(0,1,5),(0,5,4),(1,2,6),(1,6,5),(2,3,7),(2,7,6),(3,0,4),(3,4,7)]
 return v,f,BVHTree.FromPolygons(v,f,all_triangles=True)
v,f,tree=cube(2)
assert m.inside(tree,Vector((0,0,0)))
assert not m.inside(tree,Vector((3,0,0)))
assert not m.inside(tree,Vector((2,0,0)))
for size,shift,expected in [(1,(5,0,0),True),(1,(1.5,0,0),False),(.5,(0,0,0),False),(3,(0,0,0),False)]:
 pv,pf,pt=cube(size,shift)
 try:m.fit(v,tree,pv,pf,pt,10,10,(0,0),0)
 except ValueError:assert not expected
 else:assert expected
# Two overlapping closed shells are inside even when ray parity is even.
other,other_faces,_=cube(2)
joined=v+other
joined_faces=f+[tuple(i+len(v) for i in face)for face in other_faces]
assert m.inside(BVHTree.FromPolygons(joined,joined_faces,all_triangles=True),Vector((0,0,0)))
# A cached proof must stop matching after either rise or physical rim changes.
recipe={'frameFit':{'profiles':[{'riseMM':4.1}]},'supportSlots':[{'elevation':1}]}
before=m.frame.mesh_fit_contract(recipe)
recipe['frameFit']['profiles'][0]['riseMM']=4.2
assert m.frame.mesh_fit_contract(recipe)!=before
recipe['frameFit']['profiles'][0]['riseMM']=4.1
recipe['supportSlots'][0]['elevation']=1.01
assert m.frame.mesh_fit_contract(recipe)!=before
print('MAJESTIC_MESH_FIT_TEST_PASSED','separated accepted; crossing and both containment directions rejected',flush=True)
