import {test} from 'node:test';
import assert from 'node:assert/strict';
import {texturePolicy,rgbaMipBytes,checkTextureBudget} from './texture_policy.mjs';
test('default decoded budget is roughly 8.75 MiB per complete miniature',()=>{
 const policy=texturePolicy();let total=0;
 for(const role of ['render','lod']){
  const images=['basecolor','normal','orm'].map(type=>({role:type,width:policy[role][type],height:policy[role][type],rgbaMipBytes:rgbaMipBytes(policy[role][type],policy[role][type])}));
  total+=checkTextureBudget(role,images,policy);
 }
 assert.ok(Math.abs(total/1024**2-8.75)<.001);
});
test('dimensions, aggregate decoded bytes and explicit exception reason are checked',()=>{
 assert.throws(()=>rgbaMipBytes(0,1));assert.throws(()=>texturePolicy({texturePolicy:{render:{basecolor:2048}}}),/reviewed reason/);
 assert.throws(()=>texturePolicy({texturePolicy:{lod:{normal:300}}}),/Power-of-two/);
 assert.throws(()=>texturePolicy({texturePolicy:{mispelled:1}}),/Unknown/);
 const policy=texturePolicy();
 assert.throws(()=>checkTextureBudget('lod',[{role:'basecolor',width:1024,height:1024,rgbaMipBytes:rgbaMipBytes(1024,1024)}],policy),/size limit/);
 const large=Array.from({length:5},()=>({role:'basecolor',width:512,height:512,rgbaMipBytes:rgbaMipBytes(512,512)}));
 assert.throws(()=>checkTextureBudget('lod',large,policy),/decoded texture budget/);
 assert.equal(texturePolicy({texturePolicy:{reason:'Reviewed larger wings',render:{basecolor:2048,maxMiB:32}}}).render.basecolor,2048);
});
