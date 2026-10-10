import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { structureMetal, structureFlame, structureFabricPigment, shouldRepairGreenSpill } from './medieval_structure_domains.mjs';

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

test('measured cloth gaps keep sage pigment while crust and timber remain independent', () => {
  const bread = JSON.parse(fs.readFileSync(new URL('./medieval-recipes/MT1-031.json',import.meta.url))).materials;
  for (const position of [[7,4.7,43.330536],[8.5,-4.4,43.435104]]) {
    const colour = structureFabricPigment(position,bread);
    assert.ok(colour && colour[1]>colour[0]);
  }
  assert.equal(structureFabricPigment([5.6248,.1328,46.4572],bread),null);
  assert.equal(structureFabricPigment([15,0,54],bread),null);
});

test('two measured tavern flames stay separate from wax, iron cups and timber', () => {
  const sign = JSON.parse(fs.readFileSync(new URL('./medieval-recipes/MT1-034.json',import.meta.url))).materials;
  for (const y of [-26.65,26.55]) {
    assert.equal(structureFlame([-3.05,y,71.8],sign)?.kind,'flame');
    assert.deepEqual(structureMetal([-3.05,y,71.8],sign),{metallic:0,roughness:.86});
    assert.equal(structureFlame([-3.05,y,69],sign),null,'Wax cap must not emit');
    assert.equal(structureFlame([-3.05,y,64],sign),null,'Cup must not emit');
    assert.deepEqual(structureMetal([-3.05,y,64],sign),{metallic:.8,roughness:.5});
    assert.equal(structureFlame([-10,y,72],sign),null,'Post must not emit');
  }
  assert.equal(structureFlame([-3.05,0,71.8],sign),null,'Opening between candles must not emit');
});
