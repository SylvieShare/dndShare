import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { structureDomain, structureMetal, structureFlame, structureEmissionFlame, structureGlass, structureSurfacePigment, structureWoodPigment, structureFabricPigment, shouldRepairGreenSpill } from './medieval_structure_domains.mjs';

test('optional emission inset keeps light inside the flame under packing displacement', () => {
  const part={ name:'fire',kind:'flame',minMM:[-1,-1,0],maxMM:[1,1,6],rgb:[1,.5,.05],emissionInsetMM:.015 };
  const settings={surfaceParts:[part]};
  assert.equal(structureEmissionFlame([.99,0,3],settings),null);
  assert.equal(structureEmissionFlame([.98,0,3],settings),part);
  for(const dx of [-.01,0,.01])for(const dy of [-.01,0,.01])for(const dz of [-.01,0,.01])
    assert.ok(structureFlame([.98+dx,dy,3+dz],settings));
  assert.equal(structureEmissionFlame([.98,0,3],{surfaceParts:[part,{kind:'paint',minMM:[.99,-1,0],maxMM:[1,1,6]}]}),null);
});

test('emission without an inset preserves the established flame', () => {
  const part={kind:'flame',minMM:[-1,-1,0],maxMM:[1,1,6],rgb:[1,.62,.075]};
  assert.equal(structureEmissionFlame([.999,0,3],{surfaceParts:[part]}),part);
  assert.throws(()=>structureEmissionFlame([0,0,3],{surfaceParts:[{...part,emissionInsetMM:.1}]}),/emission inset/);
});

test('flame height gradient clamps, interpolates and preserves its source recipe', () => {
  const part = { name:'fire',kind:'flame',minMM:[-1,-1,0],maxMM:[1,1,6],rgb:[1,.5,.05],
    gradientZMM:[2,4],gradientRGB:[[1,.8,.1],[1,.2,.02]] };
  const settings = { surfaceParts:[part] };
  assert.deepEqual(structureFlame([0,0,1],settings).rgb,[1,.8,.1]);
  assert.deepEqual(structureFlame([0,0,3],settings).rgb,[1,.5,.060000000000000005]);
  assert.deepEqual(structureFlame([0,0,5],settings).rgb,[1,.2,.02]);
  assert.deepEqual(part.rgb,[1,.5,.05]);
  assert.equal(structureFlame([2,0,3],settings),null);
  assert.equal(structureFlame([0,0,3],{ surfaceParts:[part,{ kind:'paint',minMM:[-1,-1,2],maxMM:[1,1,4] }] }),null);
});

test('flames without a gradient preserve their existing colour and identity', () => {
  const part = { kind:'flame',minMM:[-1,-1,0],maxMM:[1,1,6],rgb:[1,.62,.075] };
  assert.equal(structureFlame([0,0,3],{ surfaceParts:[part] }),part);
});

test('flame gradients reject empty height ranges and malformed colours', () => {
  const part = { kind:'flame',minMM:[-1,-1,0],maxMM:[1,1,6],rgb:[1,.5,.05],gradientZMM:[2,2],gradientRGB:[[1,.8,.1],[1,.2,.02]] };
  assert.throws(() => structureFlame([0,0,3],{ surfaceParts:[part] }),/Flame gradient/);
  assert.throws(() => structureFlame([0,0,3],{ surfaceParts:[{ ...part,gradientZMM:[2,4],gradientRGB:[[1,.8,.1]] }] }),/Flame gradient/);
  assert.throws(() => structureFlame([0,0,3],{ surfaceParts:[{ ...part,gradientZMM:[2,3,4] }] }),/Flame gradient/);
  assert.throws(() => structureFlame([0,0,3],{ surfaceParts:[{ ...part,gradientZMM:false }] }),/Flame gradient/);
});

const recipe = JSON.parse(fs.readFileSync(new URL('./medieval-recipes/MT1-028.json', import.meta.url)));

test('stacked surface colours can use height while existing planar centres keep their meaning', () => {
  const part={name:'stacked fruit',kind:'paint',minMM:[-2,-2,0],maxMM:[2,2,8],centersMM:[[0,0,2],[0,0,6]],colorsRGB:[[.3,.6,.1],[.7,.75,.2]],variation:0,centerDimensions:3};
  assert.deepEqual(structureSurfacePigment([0,0,2],{surfaceParts:[part]}),part.colorsRGB[0]);
  assert.deepEqual(structureSurfacePigment([0,0,6],{surfaceParts:[part]}),part.colorsRGB[1]);
  delete part.centerDimensions;
  assert.deepEqual(structureSurfacePigment([0,0,6],{surfaceParts:[part]}),part.colorsRGB[0]);
});

test('plaster repaint restores its palette while preserving timber and overlaid finishes', () => {
  const timber = { minMM: [-1,-5,0], maxMM: [1,5,10] };
  const plaster = {
    kind: 'plaster', minMM: [-5,-5,0], maxMM: [5,5,10],
    rgb: [.74,.535,.275], variation: 0, excludeParts: [timber],
  };
  assert.deepEqual(structureSurfacePigment([3,0,2], {surfaceParts:[plaster]}), plaster.rgb);
  assert.equal(structureSurfacePigment([0,0,2], {surfaceParts:[plaster]}), null);
  const finish = {
    kind: 'paint', minMM: [2,-1,1], maxMM: [4,1,3], rgb: [.27,.24,.19], variation: 0,
  };
  assert.deepEqual(structureSurfacePigment([3,0,2], {surfaceParts:[plaster,finish]}), finish.rgb);
});

test('physical wood pigment restores a frame while preserving upholstery and metal', () => {
  const timber={minMM:[-5,-5,-1],maxMM:[5,5,2],axis:'x',physicalPigment:true,darkRGB:[.3,.15,.05],lightRGB:[.55,.32,.12]};
  const settings={stoneStartMM:0,stoneBlendMM:1,woodParts:[timber],surfaceParts:[{name:'cushion',kind:'paint',minMM:[-2,-2,.8],maxMM:[2,2,2],rgb:[.65,.56,.145],roughness:.85}]};
  const wood=structureWoodPigment([4,0,.5],[0,1,0],settings);
  assert.ok(wood[0]>wood[1]*1.4 && wood[1]>wood[2]*2,'Yellow upholstery must not replace the brown frame');
  assert.equal(structureWoodPigment([0,0,1],[0,0,1],settings),null,'The cushion keeps its own pigment');
  assert.equal(structureWoodPigment([6,0,1],[0,0,1],settings),null);
  const cloth={minMM:[3,-1,0],maxMM:[5,1,1],rgb:[.2,.4,.1]};
  assert.equal(structureWoodPigment([4,0,.5],[0,1,0],{...settings,fabricParts:[cloth]}),null,'Cloth retains its finish');
  settings.hardware=[{centerMM:[4,0,.5],radiiMM:[.5,.5,.5],minZMM:0}];
  assert.equal(structureWoodPigment([4,0,.5],[0,1,0],settings),null,'A fastening retains metal');
});

test('measured beam pigment agrees with straight grain on the same side face', () => {
  const timber={minMM:[-5,-5,-1],maxMM:[5,5,2],axis:'x',physicalPigment:true,darkRGB:[.3,.15,.05],lightRGB:[.55,.32,.12]};
  const settings={stoneStartMM:0,stoneBlendMM:1,woodParts:[timber]};
  const expected=structureWoodPigment([-1.3,2.1,.7],[0,1,0],settings);
  timber.axis='beam';timber.direction=[1,0,0];
  assert.deepEqual(structureWoodPigment([-1.3,2.1,.7],[0,1,0],settings),expected);
  timber.rotationZDeg=21;timber.centerMM=[0,0,0];
  assert.deepEqual(structureWoodPigment([-1.3,2.1,.7],[0,1,0],settings),expected,'A rotated mask keeps the measured global beam direction');
});

test('wrapped Y timber preserves pigment and end roughness under a quarter turn', () => {
  const part = {
    minMM: [-20,-20,0], maxMM: [20,20,30], axis: 'log-x', physicalPigment: true,
    capCentersMM: [[-10,0,15],[10,0,15]], grainRadiusMM: 2,
    endRangesMM: [[-10.1,-9.8],[9.8,10.1]], roughness: .91, endRoughness: .67,
    darkRGB: [.3,.15,.05], lightRGB: [.55,.32,.12],
    endDarkRGB: [.37,.2,.08], endLightRGB: [.65,.4,.18],
  };
  const turn = ([x,y,z]) => [-y,x,z];
  const rotated = {...part,axis:'log-y',capCentersMM:part.capCentersMM.map(turn)};
  const settings = timber => ({stoneStartMM:0,stoneBlendMM:1,woodParts:[timber]});
  for (const [point,normal] of [
    [[-3.7,1.2,16.6],[0,.6,.8]], [[4,-1.4,16.2],[0,-.7,.6]],
    [[10,1.1,15.7],[1,0,0]], [[-10,-.9,13.9],[-1,0,0]],
  ]) {
    const expected = structureWoodPigment(point,normal,settings(part));
    const actual = structureWoodPigment(turn(point),turn(normal),settings(rotated));
    actual.forEach((c,i) => assert.ok(Math.abs(c-expected[i])<1e-12));
    assert.deepEqual(structureMetal(turn(point),settings(rotated)),structureMetal(point,settings(part)));
  }
  assert.equal(structureMetal([10,0,15],settings(rotated)).roughness,.91,
    'X coordinates cannot select a cut end of Y timber');
  assert.equal(structureMetal([0,10,15],settings(rotated)).roughness,.67);
  assert.notDeepEqual(
    structureWoodPigment([0,10,15],[0,1,0],settings(rotated)),
    structureWoodPigment([0,10,15],[1,0,0],settings(rotated)),
    'Only the exposed end face receives growth rings',
  );
});

test('curved timber uses arc length and radius consistently on both wall planes', () => {
  const timber = {
    minMM: [-100, -100, -100], maxMM: [100, 100, 100], physicalPigment: true,
    darkRGB: [.3, .15, .05], lightRGB: [.55, .32, .12],
  };
  const settings = part => ({ stoneStartMM: 0, stoneBlendMM: 1, woodParts: [part] });
  const centre = [3, 12], radiusMM = 17, angle = .8, radius = 14.2;
  const expected = structureWoodPigment(
    [angle * radiusMM, radius, 0], [0, 0, 1], settings({ ...timber, axis: 'x' }),
  );
  for (const axis of ['arc-xz', 'arc-yz']) {
    const field = axis === 'arc-xz' ? 'centerXZMM' : 'centerYZMM';
    const part = { ...timber, axis, radiusMM, [field]: centre };
    const lateral = centre[0] + radius * Math.cos(angle);
    const height = centre[1] + radius * Math.sin(angle);
    const point = axis === 'arc-xz' ? [lateral, 7, height] : [7, lateral, height];
    const actual = structureWoodPigment(point, [0, 0, 1], settings(part));
    actual.forEach((c, i) => assert.ok(Math.abs(c - expected[i]) < 1e-12));
    for (const invalid of [{ radiusMM: 0 }, { [field]: [0, NaN] }])
      assert.throws(
        () => structureWoodPigment(point, [0, 0, 1], settings({ ...part, ...invalid })),
        /Measured timber arc/,
      );
  }
});

test('a tapered hoop follows its tilted axis without painting an outer wooden support', () => {
  const shell = { originMM:[3,4,5], axis:[.6,.8,0], rangeMM:[-2,2], radiusAtOriginMM:8, radiusSlope:.2, thicknessMM:1, allowanceMM:.04 };
  const part = {minMM:[-20,-20,-20],maxMM:[20,20,20],radialShell:shell};
  const point = (s,r) => [3+.6*s,4+.8*s,5+r];
  assert.equal(structureDomain(point(-1,7.8),part),true);
  assert.equal(structureDomain(point(1,8.2),part),true);
  assert.equal(structureDomain(point(-1,8.2),part),false,'Support outside the narrow end stays wood');
  assert.equal(structureDomain(point(1,7.1),part),false,'Lid inside the hoop stays wood');
  assert.equal(structureDomain(point(2.1,8.3),part),false,'Wood beyond the band stays wood');
  const rivet = {minMM:[2,3,13.6],maxMM:[4,5,14.2]};
  const union = {minMM:part.minMM,maxMM:part.maxMM,includeParts:[part,rivet]};
  assert.equal(structureDomain([3,4,14],union),true,'A separately measured protruding rivet stays included');
  assert.equal(structureDomain([3,4,14.3],union),false);
});

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
