// Preparing the catalogue is an offline operation; model bytes stay in ignored models/.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(process.env.MAP_MODEL_TOOLS || '/private/tmp/dndshare-model-tools', 'package.json'));
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { meshopt, simplify } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = require('meshoptimizer');
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const report = JSON.parse(await fs.readFile(path.join(root, 'models/prepared/textured/report.json'), 'utf8'));
const out = path.join(root, 'models/prepared/runtime');
await fs.mkdir(out, { recursive: true });
for (const model of report) {
  const input = path.join(root, 'models', model.glb.path);
  for (const tier of ['render', 'lod']) {
    const doc = await io.read(input);
    if (tier === 'lod') await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: .25, error: .005 }));
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const file = path.join(out, `${model.code}.${tier}.glb`);
    await io.write(file, doc);
    const triangles = doc.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives()
      .reduce((n, p) => n + p.getIndices().getCount() / 3, 0), 0);
    console.log(model.code, tier, triangles, (await fs.stat(file)).size);
  }
}
