// Correct only ORM green in reviewed GLBs, preserving mesh/UV and other channels.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readGlb, replaceImages } from './glb_textures.mjs';
import { rasterizeSurface, seedSurfaceGutters, extendUvGutters } from './uv_surface.mjs';
import { structureMetal } from './medieval_structure_domains.mjs';
import { torchSurface } from './medieval_torch_domains.mjs';
const code = process.argv[2];
assert.match(code || '', /^MT1-\d{3}$/);
const root = path.resolve(import.meta.dirname, '../..');
const directory = path.join(root, 'models/collections/medieval-town-vol1/review', code);
const current = JSON.parse(await fs.readFile(path.join(directory, 'report.json'), 'utf8'));
const baseline = path.join(directory, 'candidates/roughness-baseline');
const resume = process.argv.includes('--resume');
const report = resume ? JSON.parse(await fs.readFile(path.join(baseline,'report.json'),'utf8')) : current;
assert.ok(report.publication?.assetsVerified, 'Start from a confirmed publication');
assert.ok(!report.roughnessCorrection, 'Already corrected');
if (resume) {
  assert.ok(!current.publication?.assetsVerified, 'Do not replace an already confirmed correction');
  const registry = JSON.parse(await fs.readFile(path.join(root,'models/collections/medieval-town-vol1/registry-snapshot.json'),'utf8'));
  assert.deepEqual(registry.find(m => m.id===report.model.id),report.model,'Saved baseline is no longer the current publication');
  assert.deepEqual(current.recipe,report.recipe);
}
const settings = report.recipe.materials;
assert.ok(['structure','torch'].includes(settings.kind));
if (!resume) await fs.mkdir(baseline);
const candidate = path.join(directory, 'candidates/compact');
await fs.mkdir(candidate, { recursive: true });
for (const file of resume ? [] : ['render.glb','lod.glb','shadow.glb','preview-model.glb','lod-preview-model.glb','preview.png','reverse.png','top.png','report.json']) {
  await fs.copyFile(path.join(directory, file),path.join(baseline, file));
}
const require = createRequire('/private/tmp/dndshare-model-tools/package.json');
const sharp = require('sharp'), { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { MeshoptDecoder } = require('meshoptimizer');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const surface = p => settings.kind==='torch' ? torchSurface(p, settings) : structureMetal(p, settings);
function imageIndex(glb) {
  const material = glb.json.materials.find(m => m.pbrMetallicRoughness?.metallicRoughnessTexture);
  return glb.json.textures[material.pbrMetallicRoughness.metallicRoughnessTexture.index].source;
}
function imageBytes(glb, index) {
  const view = glb.json.bufferViews[glb.json.images[index].bufferView];
  return glb.bin.subarray(view.byteOffset || 0, (view.byteOffset || 0)+view.byteLength);
}
function verifyUnchanged(before, after, changedImage) {
  assert.deepEqual(after.json.meshes, before.json.meshes);
  assert.deepEqual(after.json.nodes, before.json.nodes);
  assert.deepEqual(after.json.materials, before.json.materials);
  const imageViews = new Set(before.json.images.map(i => i.bufferView));
  for (let i=0;i<before.json.bufferViews.length;i++) {
    if (imageViews.has(i)) continue;
    const a = before.json.bufferViews[i], b = after.json.bufferViews[i];
    const av = a.extensions?.EXT_meshopt_compression || a;
    const bv = b.extensions?.EXT_meshopt_compression || b;
    assert.equal(av.buffer, bv.buffer);
    if (av.buffer!==0) continue;
    assert.equal(av.byteLength, bv.byteLength);
    assert.deepEqual(before.bin.subarray(av.byteOffset || 0,(av.byteOffset || 0)+av.byteLength),
      after.bin.subarray(bv.byteOffset || 0,(bv.byteOffset || 0)+bv.byteLength));
  }
  for (let i=0;i<before.json.images.length;i++) if (i!==changedImage) assert.deepEqual(imageBytes(before,i),imageBytes(after,i));
}
for (const [tier, preview] of [['render','preview-model.glb'],['lod','lod-preview-model.glb']]) {
  const original = await fs.readFile(path.join(baseline,tier+'.glb'));
  const glb = readGlb(original), doc = await io.readBinary(original), index = imageIndex(glb);
  const { data, info } = await sharp(imageBytes(glb,index)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const originalData = Buffer.from(data), roughness = Buffer.alloc(info.width*info.height);
  for (let i=0;i<roughness.length;i++) roughness[i] = data[i*3+1];
  const write = (i,p,used) => {
    let value = surface(p);
    const metallic = originalData[i*3+2]/255;
    if (used && Math.abs(value.metallic-metallic)>.015) {
      // Preserve the accepted metallic side of a quantized hard boundary and
      // keep roughness on the same material, within the existing 0.01 mm bound.
      let compatible = null;
      for (const dx of [-.01,0,.01]) for (const dy of [-.01,0,.01]) for (const dz of [-.01,0,.01]) {
        const sample = surface([p[0]+dx,p[1]+dy,p[2]+dz]);
        if (Math.abs(sample.metallic-metallic)<=.015) compatible = sample;
      }
      assert.ok(compatible,'Accepted metallic pixel exceeds the packing position bound');
      value = compatible;
    }
    roughness[i] = Math.round(value.roughness*255);
  };
  let coverage = rasterizeSurface(doc,info.width,info.height,(i,p) => write(i,p,true),'MetallicRoughness');
  coverage = seedSurfaceGutters(doc,info.width,info.height,coverage,(i,p) => write(i,p,false),1,'MetallicRoughness');
  extendUvGutters(roughness,1,coverage.slice(),info.width,info.height,4);
  for (let i=0;i<roughness.length;i++) data[i*3+1] = roughness[i];
  const orm = await sharp(data,{raw:info}).png().toBuffer();
  const decoded = await sharp(orm).removeAlpha().raw().toBuffer();
  for (let i=0;i<roughness.length;i++) {
    assert.equal(decoded[i*3],originalData[i*3]);
    assert.equal(decoded[i*3+2],originalData[i*3+2]);
  }
  const patched = replaceImages(glb,new Map([[index,orm]]));
  verifyUnchanged(readGlb(original),readGlb(patched),index);
  await fs.writeFile(path.join(candidate,tier+'.glb'),patched);
  const previewBytes = await fs.readFile(path.join(baseline,preview));
  const previewGlb = readGlb(previewBytes), pi = imageIndex(previewGlb);
  const patchedPreview = replaceImages(previewGlb,new Map([[pi,orm]]));
  verifyUnchanged(readGlb(previewBytes),readGlb(patchedPreview),pi);
  await fs.writeFile(path.join(candidate,preview),patchedPreview);
  report.tiers[tier].bytes = patched.length;
}
await fs.copyFile(path.join(baseline,'shadow.glb'),path.join(candidate,'shadow.glb'));
report.publication = null;
report.roughnessCorrection = { changed: 'ORM green only', preserved: 'mesh/UV/tangents/albedo/normal/AO/metallic/emissive/shadow/identity/placement',
  reason: 'Physical metal-domain packing must preserve the separately painted roughness of timber, fabric, fuel and produce.' };
report.optimization = { candidate: 'compact', selection: 'pending visual review' };
await fs.writeFile(path.join(candidate,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log('MEDIEVAL_ROUGHNESS_CORRECTED',code);
