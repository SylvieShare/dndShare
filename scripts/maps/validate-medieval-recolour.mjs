// A palette correction must preserve the accepted geometry and PBR data maps.
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const code = process.argv[2];
if (!/^MT1-\d{3}$/.test(code || '')) throw new Error('One source code required');
const require = createRequire('/private/tmp/dndshare-model-tools/package.json');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { MeshoptDecoder } = require('meshoptimizer');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const base = path.resolve(import.meta.dirname, '../../models/collections/medieval-town-vol1/review', code);
function geometry(doc) {
  return doc.getRoot().listNodes().filter(n => n.getMesh()).map(n => ({ matrix: n.getWorldMatrix(),
    primitives: n.getMesh().listPrimitives().map(p => ({ indices: p.getIndices().getArray(),
      attributes: Object.fromEntries(p.listSemantics().map(s => [s, p.getAttribute(s).getArray()])) })) }));
}
for (const tier of ['render', 'lod', 'shadow']) {
  const old = await io.read(path.join(base, 'candidates/cool-baseline', tier+'.glb'));
  const next = await io.read(path.join(base, 'candidates/compact', tier+'.glb'));
  assert.deepEqual(geometry(next), geometry(old), 'Palette correction changed geometry/UV/normals');
  if (tier!=='shadow') for (const [i, material] of old.getRoot().listMaterials().entries()) {
    for (const slot of ['Normal', 'MetallicRoughness']) {
      assert.deepEqual(next.getRoot().listMaterials()[i][`get${slot}Texture`]?.()?.getImage(),
        material[`get${slot}Texture`]?.()?.getImage(), 'Palette correction changed '+slot);
    }
  }
  console.log('MEDIEVAL_RECOLOUR_PRESERVATION', code, tier, 'geometry/UV/normal/ORM unchanged');
}
