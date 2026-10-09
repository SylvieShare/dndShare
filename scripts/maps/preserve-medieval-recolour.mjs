// Transfer only new albedo bytes onto the accepted geometry and PBR data maps.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readGlb, replaceImages } from './glb_textures.mjs';
const code = process.argv[2];
if (!/^MT1-\d{3}$/.test(code || '')) throw new Error('One source code required');
const base = path.resolve(import.meta.dirname, '../../models/collections/medieval-town-vol1/review', code);
const previous = path.join(base, 'candidates/cool-baseline');
const selected = path.join(base, 'candidates/compact');
const require = createRequire('/private/tmp/dndshare-model-tools/package.json');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { MeshoptDecoder } = require('meshoptimizer');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const file of ['render.glb', 'lod.glb', 'preview-model.glb', 'lod-preview-model.glb']) {
  const oldBytes = await fs.readFile(path.join(previous, file));
  const newBytes = await fs.readFile(path.join(selected, file));
  const oldDoc = await io.readBinary(oldBytes), newDoc = await io.readBinary(newBytes);
  assert.equal(newDoc.getRoot().listMeshes().length, oldDoc.getRoot().listMeshes().length);
  for (const [i, mesh] of oldDoc.getRoot().listMeshes().entries()) {
    for (const [j, primitive] of mesh.listPrimitives().entries()) {
      const next = newDoc.getRoot().listMeshes()[i].listPrimitives()[j];
      assert.deepEqual(next.getIndices().getArray(), primitive.getIndices().getArray());
      for (const slot of ['POSITION','NORMAL','TEXCOORD_0'])
        assert.deepEqual(next.getAttribute(slot)?.getArray(), primitive.getAttribute(slot)?.getArray(), 'Albedo cannot be transferred onto a changed surface');
    }
  }
  const old = readGlb(oldBytes), next = readGlb(newBytes), images = new Map();
  for (const [i, material] of old.json.materials.entries()) {
    const oldTexture = material.pbrMetallicRoughness?.baseColorTexture?.index;
    if (oldTexture===undefined) continue;
    const newTexture = next.json.materials[i].pbrMetallicRoughness.baseColorTexture.index;
    const oldImage = old.json.textures[oldTexture].source;
    const newImage = next.json.textures[newTexture].source;
    assert.equal(next.json.images[newImage].mimeType, old.json.images[oldImage].mimeType);
    const view = next.json.bufferViews[next.json.images[newImage].bufferView];
    images.set(oldImage, next.bin.subarray(view.byteOffset || 0, (view.byteOffset || 0)+view.byteLength));
  }
  if (!images.size) throw new Error('No albedo to transfer');
  await fs.writeFile(path.join(selected, file), replaceImages(old, images));
}
await fs.copyFile(path.join(previous, 'shadow.glb'), path.join(selected, 'shadow.glb'));
const reportFile = path.join(selected, 'report.json');
const report = JSON.parse(await fs.readFile(reportFile, 'utf8'));
for (const tier of ['render','lod','shadow']) report.tiers[tier].bytes = (await fs.stat(path.join(selected, tier+'.glb'))).size;
report.recolour = { preserved: 'accepted geometry/UV/tangents/normal/ORM/shadow', changed: 'albedo only' };
await fs.writeFile(reportFile, JSON.stringify(report, null, 2)+'\n');
console.log('MEDIEVAL_ALBEDO_TRANSFER', code);
