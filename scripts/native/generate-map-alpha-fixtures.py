"""Deterministic GLB fixtures for independent opaque/alpha/depth rendering checks."""
from pathlib import Path
import json,struct
root=Path(__file__).resolve().parents[2]/'native/androidApp/src/androidTest/assets/maps'

def write(name,planes,unlit=True):
 binary=bytearray();views=[];accessors=[];primitives=[];materials=[]
 def accessor(values,components,kind,minimum=None,maximum=None):
  while len(binary)%4:binary.append(0)
  start=len(binary);binary.extend(struct.pack('<'+('f' if kind==5126 else 'H')*len(values),*values))
  views.append({'buffer':0,'byteOffset':start,'byteLength':len(binary)-start})
  data={'bufferView':len(views)-1,'componentType':kind,'count':len(values)//components,'type':{1:'SCALAR',3:'VEC3'}[components]}
  if minimum is not None:data['min']=minimum;data['max']=maximum
  accessors.append(data);return len(accessors)-1
 for y,colour,alpha in planes:
  pos=accessor([-1,y,-1,-1,y,1,1,y,1,1,y,-1],3,5126,[-1,y,-1],[1,y,1])
  normal=accessor([0,1,0]*4,3,5126)
  indices=accessor([0,1,2,0,2,3],1,5123,[0],[3])
  material={'pbrMetallicRoughness':{'baseColorFactor':colour+[alpha],'metallicFactor':0,'roughnessFactor':1}}
  if unlit:material['extensions']={'KHR_materials_unlit':{}}
  if alpha<1:material['alphaMode']='BLEND'
  materials.append(material)
  primitives.append({'attributes':{'POSITION':pos,'NORMAL':normal},'indices':indices,'material':len(materials)-1})
 while len(binary)%4:binary.append(0)
 data={'asset':{'version':'2.0'},'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':accessors,
       'materials':materials,'meshes':[{'primitives':primitives}],'nodes':[{'mesh':0}],'scenes':[{'nodes':[0]}],'scene':0}
 if unlit:data['extensionsUsed']=['KHR_materials_unlit']
 encoded=json.dumps(data,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
 total=12+8+len(encoded)+8+len(binary)
 (root/f'{name}.glb').write_bytes(struct.pack('<IIIII',0x46546c67,2,total,len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
write('flat-blue',[(0,[.2,.4,.8],1)])
write('flat-green',[(0,[.1,.8,.1],1)])
write('flat-red-blend',[(0,[1,.05,.05],.5)])
write('flat-mixed',[(0,[.1,.8,.1],1),(.5,[1,.05,.05],.5)])
write('flat-shadow-blend',[(0,[.6,.6,.6],.8)],unlit=False)
