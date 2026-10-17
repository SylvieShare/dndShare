"""Run in Blender: flame vertex colour and mask agree with the packed gradient."""
import json
from pathlib import Path
import sys
import numpy as np
import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
from medieval_structure import paint

recipe=json.loads((Path(__file__).parent/'medieval-recipes/MT1-060.json').read_text())
recipe['materials']['woodParts']=[]
recipe['materials']['surfaceParts']=[dict(name='graded fire',kind='flame',minMM=[-1,-1,0],maxMM=[1,1,6],
    rgb=[1,.5,.05],roughness=.9,variation=0,gradientZMM=[2,4],gradientRGB=[[1,.8,.1],[1,.2,.02]])]
vertices=[(x,y,z) for z in [1,3,5] for x,y in [(-.1,0),(.1,0),(0,.1)]]
mesh=bpy.data.meshes.new('Fire gradient');mesh.from_pydata(vertices,[],[(0,1,2),(3,4,5),(6,7,8)]);mesh.update()
obj=bpy.data.objects.new('Fire gradient',mesh);bpy.context.collection.objects.link(obj)
paint(obj,recipe)
values=np.empty(len(vertices)*4,np.float32);mesh.color_attributes['Paint'].data.foreach_get('color',values)
colours=np.array([[1,.8,.1],[1,.5,.06],[1,.2,.02]])
expected=np.where(colours<=.04045,colours/12.92,((colours+.055)/1.055)**2.4)
np.testing.assert_allclose(values.reshape(-1,4)[:,:3],np.repeat(expected,3,axis=0),rtol=2e-5,atol=2e-6)
mesh.color_attributes['Flame'].data.foreach_get('color',values)
np.testing.assert_allclose(values.reshape(-1,4),1)
print('FLAME_GRADIENT_CONFIRMED',flush=True)
