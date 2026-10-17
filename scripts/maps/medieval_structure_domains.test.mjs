import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { structureMetal, structureFlame, structureGlass, structureSurfacePigment, structureFabricPigment, shouldRepairGreenSpill } from './medieval_structure_domains.mjs';

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

test('real green glass is preserved against sparse brown vertices while adjacent wood is repaired', () => {
  const settings = { surfaceParts:[{kind:'glass',name:'pane',minMM:[-14.5,-8.5,49],maxMM:[-12.5,-1,57.5],rgb:[.48,.60,.17],roughness:.18}],stoneStartMM:24.2,stoneBlendMM:.65 };
  assert.equal(structureGlass([-13,-5,53],settings)?.kind,'glass');
  assert.equal(shouldRepairGreenSpill([40,180,12],[.12,.05,.015,1],[-13,-5,53],settings),false);
  assert.equal(structureGlass([-11.77,0,53],settings),null);
  assert.equal(shouldRepairGreenSpill([40,180,12],[.12,.05,.015,1],[-11.77,0,53],settings),true);
  assert.deepEqual(structureMetal([-13,-5,53],settings),{metallic:0,roughness:.18});
});

test('hidden bar ceramics retain their pigments while supporting wood remains unpainted', () => {
  const bar = JSON.parse(fs.readFileSync(new URL('./medieval-recipes/MT1-044.json',import.meta.url))).materials;
  for (const p of [[-7,-4.2,36.5],[-7,7.2,36.5]]) {
    const pigment = structureSurfacePigment(p,bar);
    assert.ok(pigment && pigment[0]>.68 && pigment[1]>.54);
  }
  assert.ok(structureSurfacePigment([-8,-11,37],bar));
  assert.equal(structureSurfacePigment([-5.85,1.5,34.3],bar),null,'Shelf stays timber');
  assert.equal(structureSurfacePigment([-11.7,-4.2,36.5],bar),null,'Backing stays timber');
  const vessels = JSON.parse(fs.readFileSync(new URL('./medieval-recipes/MT1-024.json',import.meta.url))).materials;
  assert.ok(structureSurfacePigment([-11.35,-5.45,40],vessels));
  assert.equal(structureSurfacePigment([-1.8,-5.3,46],vessels),null,'Cork overrides ceramic');
});

test('solid paint and foam retain independent colours while later liquids take priority', () => {
  const painted = {name:'paint',kind:'paint',minMM:[-2,-2,0],maxMM:[2,2,2],rgb:[.7,.12,.04],variation:0};
  const foam = {name:'foam',kind:'foam',minMM:[-1,-1,1],maxMM:[1,1,2],rgb:[.85,.75,.5],variation:0};
  const liquid = {...foam,kind:'liquid',minMM:[-.2,-.2,1],maxMM:[.2,.2,2]};
  const settings = {surfaceParts:[painted,foam,liquid]};
  assert.deepEqual(structureSurfacePigment([1.5,0,1],settings),painted.rgb);
  assert.deepEqual(structureSurfacePigment([.5,0,1.5],settings),foam.rgb);
  assert.equal(structureSurfacePigment([0,0,1.5],settings),null);
  assert.equal(structureSurfacePigment([3,0,1],settings),null);
});

test('a measured upper bound keeps covered fastener metal off the spoon above it', () => {
  const bar = JSON.parse(fs.readFileSync(new URL('./medieval-recipes/MT1-050.json',import.meta.url))).materials;
  const head = bar.hardware[0], centre = head.centerMM;
  const above = [centre[0],centre[1],43.58];
  const original = {...bar,hardware:[head]};
  assert.ok(structureMetal(above,original).metallic>.8,'The old volume reaches the overlaid spoon');
  const bounded = {...bar,hardware:[{...head,maxZMM:43.49}]};
  assert.ok(structureMetal(centre,bounded).metallic>.8,'The actual cap remains metallic');
  assert.equal(structureMetal(above,bounded).metallic,0,'The spoon keeps its own material');
  assert.equal(structureMetal(above,bounded).roughness,.88);
});
