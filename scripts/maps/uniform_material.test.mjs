import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {applyUniformMaterial,assertUniformMaterial,uniformMaterialSettings} from './uniform_material.mjs';
const require=createRequire('/private/tmp/dndshare-model-tools/package.json');
const {Document}=require('@gltf-transform/core');
test('uniform PBR removes image dependencies while preserving geometry and normals',()=>{
 const doc=new Document(),buffer=doc.createBuffer();
 const accessor=(type,values)=>doc.createAccessor().setType(type).setArray(new Float32Array(values)).setBuffer(buffer);
 const position=accessor('VEC3',[0,0,0,1,0,0,0,1,0]),normal=accessor('VEC3',[0,0,1,0,0,1,0,0,1]);
 const uv=accessor('VEC2',[0,0,1,0,0,1]),color=accessor('VEC4',[1,1,1,1,1,1,1,1,1,1,1,1]);
 const mat=doc.createMaterial().setBaseColorTexture(doc.createTexture().setImage(new Uint8Array([1,2,3])).setMimeType('image/png'));
 const primitive=doc.createPrimitive().setAttribute('POSITION',position).setAttribute('NORMAL',normal).setAttribute('TEXCOORD_0',uv).setAttribute('COLOR_0',color).setMaterial(mat);
 doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(primitive)));
 const p=position.getArray().slice(),n=normal.getArray().slice(),settings={srgb:[0,.5,1],roughness:.94,metallic:0};
 applyUniformMaterial(doc,settings);assertUniformMaterial(doc,settings);
 assert.deepEqual(position.getArray(),p);assert.deepEqual(normal.getArray(),n);assert.equal(doc.getRoot().listTextures().length,0);
 assert.deepEqual(primitive.listSemantics().sort(),['NORMAL','POSITION']);
 assert.ok(Math.abs(mat.getBaseColorFactor()[1]-.21404114048223255)<1e-8);
 mat.setRoughnessFactor(.1);assert.throws(()=>assertUniformMaterial(doc,settings),/factors changed/);
});
test('uniform PBR rejects invalid component values',()=>{
 for(const settings of [{srgb:[.3,.3],roughness:.9},{srgb:[.3,NaN,.3],roughness:.9},{srgb:[.3,.3,.3],roughness:1.1}])assert.throws(()=>uniformMaterialSettings(settings));
});
