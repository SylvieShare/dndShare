import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { structureMetal, shouldRepairGreenSpill } from './medieval_structure_domains.mjs';

const recipe = JSON.parse(fs.readFileSync(new URL('./medieval-recipes/MT1-028.json', import.meta.url)));

test('market canopy keeps measured frame surfaces wooden and its fasteners metallic', () => {
  for (const position of [[15,13,64], [15,0,54], [16.4,0,51], [16.4,-8,68]]) {
    assert.deepEqual(structureMetal(position, recipe.materials), { metallic: 0, roughness: .88 });
  }
  assert.deepEqual(structureMetal([0,0,69], recipe.materials), { metallic: 0, roughness: .98 });
  assert.deepEqual(structureMetal([16,-9,72.5], recipe.materials), { metallic: 0, roughness: .98 });
  for (const position of [[-16,0,73.45134], [-16,3,76.18345], [16,0,73.84945], [16,3,75.78873], [16,5,78.23123]]) {
    assert.deepEqual(structureMetal(position, recipe.materials), { metallic: 0, roughness: .98 });
  }
  for (const position of [[15.093884,0,69], [15.141462,3,71.7], [15.616188,0,51]]) {
    assert.deepEqual(structureMetal(position, recipe.materials), { metallic: 0, roughness: .88 });
  }
  for (const fastener of recipe.materials.hardware.slice(0,4)) {
    const surface = structureMetal(fastener.centerMM, recipe.materials);
    assert.equal(surface.metallic, .9);
    assert.ok(Math.abs(surface.roughness-.55)<1e-10);
  }
});

test('measured potion bottoms and cork caps retain independent finishes below the canopy', () => {
  for (const part of recipe.materials.surfaceParts.filter(p => p.kind==='liquid')) {
    assert.deepEqual(structureMetal(part.ellipsoid.centerMM, recipe.materials), { metallic: 0, roughness: .22 });
  }
  for (const part of recipe.materials.surfaceParts.filter(p => p.kind==='cork')) {
    const position = part.minMM.map((v,i) => (v+part.maxMM[i])/2);
    assert.deepEqual(structureMetal(position, recipe.materials), { metallic: 0, roughness: .98 });
  }
});

test('genuine baked potion colour survives sparse brown LOD vertex colours while wood spill is repaired', () => {
  const greenPixel = [40,180,12], sparseBrownVertex = [.12,.05,.015,1];
  for (const part of recipe.materials.surfaceParts.filter(p => p.kind==='liquid')) {
    assert.equal(shouldRepairGreenSpill(greenPixel, sparseBrownVertex, part.ellipsoid.centerMM, recipe.materials), false);
  }
  assert.equal(shouldRepairGreenSpill(greenPixel, sparseBrownVertex, [15,0,54], recipe.materials), true);
});
