// Validate decoded material channels on actual packed physical surfaces.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { rasterizeSurface } from './uv_surface.mjs';
import { torchSurface, torchFlameDomain } from './medieval_torch_domains.mjs';
import { structureMetal } from './medieval_structure_domains.mjs';
const require = createRequire('/private/tmp/dndshare-model-tools/package.json');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { MeshoptDecoder } = require('meshoptimizer');
const sharp = require('sharp');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const code = process.argv[2], candidate = process.argv[3];
assert.match(code, /^MT1-\d{3}$/);
const directory = path.resolve(import.meta.dirname, '../../models/collections/medieval-town-vol1/review', code, ...(candidate ? ['candidates', candidate] : []));
const reportPath = path.join(directory, 'report.json');
const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
const settings = report.recipe.materials;
assert.ok(['torch','structure'].includes(settings.kind));
const surfaceAt = p => settings.kind==='structure' ? structureMetal(p, settings) : torchSurface(p, settings);
const evidence = {};
for (const tier of ['render', 'lod']) {
  const doc = await io.read(path.join(directory, tier+'.glb'));
  const material = doc.getRoot().listMaterials().find(m => m.getMetallicRoughnessTexture());
  assert.equal(material.getMetallicFactor(), 1);
  const { data: orm, info } = await sharp(Buffer.from(material.getMetallicRoughnessTexture().getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let metalSamples = 0, mismatches = 0, roughnessMismatches = 0, quantizedBoundarySamples = 0;
  rasterizeSurface(doc, info.width, info.height, (i,p) => {
    const actual = orm[i*3+2]/255, actualRoughness = orm[i*3+1]/255, expected = surfaceAt(p);
    if (actual>.1) metalSamples++;
    if (Math.abs(actual-expected.metallic)>.015 || Math.abs(actualRoughness-expected.roughness)>.015) {
      // Packed POSITION/UV values can move a sample across a hard metal edge.
      // Permit only the measured packing bound (0.01 native mm), not spill
      // onto a neighbouring material or any texture-pixel-size allowance.
      let boundary = false;
      // Include interior offsets: a continuous bolt feather can match halfway
      // between the centre and a corner without matching either endpoint.
      for (const dx of [-.01, -.005, 0, .005, .01]) for (const dy of [-.01, -.005, 0, .005, .01]) for (const dz of [-.01, -.005, 0, .005, .01]) {
        const sample = surfaceAt([p[0]+dx,p[1]+dy,p[2]+dz]);
        if (Math.abs(actual-sample.metallic)<=.015 && Math.abs(actualRoughness-sample.roughness)<=.015) boundary = true;
      }
      if (boundary) quantizedBoundarySamples++;
      else {
        if (Math.abs(actual-expected.metallic)>.015) mismatches++;
        if (Math.abs(actualRoughness-expected.roughness)>.015) roughnessMismatches++;
      }
    }
  }, 'MetallicRoughness');
  assert.equal(mismatches, 0, 'Metal channel escaped the measured iron domains');
  assert.equal(roughnessMismatches, 0, 'Packing changed per-material roughness');
  let flameSamples = 0, outsideFlame = 0;
  if (settings.kind==='torch' && settings.torch.flameReference) {
    assert.ok(material.getEmissiveTexture());
    const { data, info: e } = await sharp(Buffer.from(material.getEmissiveTexture().getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    rasterizeSurface(doc, e.width, e.height, (i,p) => {
      if (Math.max(...data.subarray(i*3, i*3+3))>8) {
        flameSamples++;
        if (!torchFlameDomain(p, settings.torch)) outsideFlame++;
      }
    }, 'Emissive');
    assert.ok(flameSamples>50);
    assert.equal(outsideFlame, 0, 'Emission escaped the measured flame domain');
  } else assert.equal(material.getEmissiveTexture(), null);
  evidence[tier] = { metalSamples, metalDomainMismatches: mismatches, roughnessDomainMismatches: roughnessMismatches, quantizedBoundarySamples,
    packingPositionToleranceMM: .01, flameSamples, emissionOutsideFlame: outsideFlame };
}
report.materialChannelReview = evidence;
await fs.writeFile(reportPath, JSON.stringify(report, null, 2)+'\n');
console.log('MEDIEVAL_MATERIAL_CHANNELS', code, evidence);
