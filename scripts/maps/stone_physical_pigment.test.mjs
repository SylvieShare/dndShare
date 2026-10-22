import test from "node:test";
import assert from "node:assert/strict";
import {
  structureStonePigment,
  structureWoodPigment,
  bakedColourShade,
} from "./medieval_structure_domains.mjs";

test("physical log cuts retain measured growth rings independently of the shaft grain", () => {
  const part = {
    minMM: [-10, -10, -10],
    maxMM: [10, 10, 10],
    axis: "log-x",
    physicalPigment: true,
    capCentersMM: [[1, 0, 0]],
    grainRadiusMM: 2,
    endRangesMM: [[-2, 2]],
    endDarkRGB: [0.28, 0.155, 0.06],
    endLightRGB: [0.57, 0.37, 0.145],
    darkRGB: [0.105, 0.065, 0.028],
    lightRGB: [0.29, 0.16, 0.065],
    roughness: 0.94,
    endRoughness: 0.94,
  };
  const m = { woodParts: [part] },
    p = [1, 1, 0],
    rgb = structureWoodPigment(p, [1, 0, 0], m),
    weight = 0.5 + 0.24 * Math.sin(5.8);
  assert.ok(
    rgb.every(
      (v, i) =>
        Math.abs(
          v -
            (part.endDarkRGB[i] * (1 - weight) + part.endLightRGB[i] * weight),
        ) < 1e-12,
    ),
  );
  assert.notDeepEqual(structureWoodPigment(p, [0, 1, 0], m), rgb);
});
const box = { minMM: [-1, -1, 20], maxMM: [1, 1, 50] },
  settings = {
    physicalStonePigment: true,
    stoneStartMM: 17.5,
    stoneBlendMM: 0.65,
    stoneDarkRGB: [0.31, 0.3, 0.265],
    stoneLightRGB: [0.58, 0.55, 0.48],
    woodParts: [],
    stoneParts: [],
    surfaceParts: [],
  };
test("stone correction cannot recolour timber, skin or iron domains", () => {
  assert.equal(
    structureStonePigment([0, 0, 30], { ...settings, woodParts: [box] }),
    null,
  );
  for (const part of [
    { ...box, kind: "paint", rgb: [0.76, 0.43, 0.37], roughness: 0.72 },
    {
      ...box,
      kind: "paint",
      rgb: [0.21, 0.185, 0.145],
      roughness: 0.6,
      metallic: 0.8,
    },
  ])
    assert.equal(
      structureStonePigment([0, 0, 30], { ...settings, surfaceParts: [part] }),
      null,
    );
  assert.equal(
    structureStonePigment([0, 0, 30], {
      ...settings,
      physicalStonePigment: false,
    }),
    null,
  );
});
test("sooty stone overrides overlapping broad fuel volumes and keeps its own palette", () => {
  const rgb = structureStonePigment([0, 0, 30], {
    ...settings,
    woodParts: [box],
    stoneParts: [
      { ...box, darkRGB: [0.1, 0.09, 0.075], lightRGB: [0.26, 0.24, 0.21] },
    ],
  });
  assert.ok(rgb[0] >= 0.1 && rgb[0] <= 0.26);
  assert.ok(rgb[0] > rgb[1] && rgb[1] > rgb[2]);
  const ordinary = structureStonePigment([2, 0, 30], settings);
  assert.ok(ordinary[0] > ordinary[1] && ordinary[1] > ordinary[2]);
});
test("hue repair preserves baked shading independently of an interpolated wood tint", () => {
  const vertex = [0.2, 0.1, 0.05],
    scale = 0.65,
    encode = (v) =>
      255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055),
    baked = vertex.map((v) => encode(v * scale));
  assert.ok(Math.abs(bakedColourShade(baked, vertex) - scale) < 1e-12);
  assert.equal(bakedColourShade([0, 0, 0], vertex), 1);
  assert.equal(bakedColourShade([255, 255, 255], vertex), 1.2);
});
