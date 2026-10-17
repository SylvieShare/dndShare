"""Run with Blender: vertically stacked surface colours retain separate pigments."""
import json
from pathlib import Path
import sys
import numpy as np
import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
from medieval_structure import paint
recipe=json.loads((Path(__file__).parent/'medieval-recipes/MT1-060.json').read_text())
recipe['materials']['woodParts']=[]
colours=np.array([[.3,.6,.1],[.7,.75,.2]])
recipe['materials']['surfaceParts']=[{'name':'stacked fruit','kind':'paint','minMM':[-1,-1,1],'maxMM':[1,1,6],'centersMM':[[0,0,2],[0,0,5]],'centerDimensions':3,'colorsRGB':colours.tolist(),'rgb':colours[0].tolist(),'roughness':.6,'variation':0}]
mesh=bpy.data.meshes.new('Stacked test');mesh.from_pydata([(-.1,0,2),(.1,0,2),(0,.1,2),(-.1,0,5),(.1,0,5),(0,.1,5)],[],[(0,1,2),(3,4,5)]);mesh.update();obj=bpy.data.objects.new('Stacked test',mesh);bpy.context.collection.objects.link(obj)
paint(obj,recipe)
values=np.empty(24,np.float32);mesh.color_attributes['Paint'].data.foreach_get('color',values)
expected=np.where(colours<=.04045,colours/12.92,((colours+.055)/1.055)**2.4)
np.testing.assert_allclose(values.reshape(-1,4)[:,:3],np.repeat(expected,3,axis=0),rtol=2e-5,atol=2e-6)
print('STACKED_SURFACE_COLOURS_CONFIRMED',flush=True)
