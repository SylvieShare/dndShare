import assert from "node:assert/strict";

export const GLASS_CHROMATICITY_TOLERANCE = 0.035;
const rgb = value => assert.ok(Array.isArray(value) && value.length === 3 &&
  value.every(c => Number.isFinite(c) && c >= 0 && c <= 1), "Finite glass RGB required");

export function expectedGlassRGB(colour) {
  rgb(colour);
  return colour.map(c => {
    const linear = (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * 0.9;
    return linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  });
}

export function glassChromaticityError(actual, expected) {
  rgb(actual); rgb(expected);
  const a = actual.reduce((s, v) => s + v, 0), b = expected.reduce((s, v) => s + v, 0);
  if (a < 0.02 || b < 0.02) return Infinity;
  return Math.max(...actual.map((v, i) => Math.abs(v / a - expected[i] / b)));
}

export function glassProbes(part) {
  const probes = part.probesMM ?? [{ key: "centre", pointMM: part.probeMM ??
    part.minMM.map((v, i) => (v + part.maxMM[i]) / 2) }];
  assert.ok(Array.isArray(probes) && probes.length > 0, "Measured glass probes required");
  const seen = new Set();
  for (const probe of probes) {
    assert.ok(typeof probe.key === "string" && probe.key.length > 0 && !seen.has(probe.key));
    assert.ok(Array.isArray(probe.pointMM) && probe.pointMM.length === 3 && probe.pointMM.every(Number.isFinite));
    seen.add(probe.key);
  }
  return probes;
}

export const glassProbeCount = parts => parts.reduce((count, part) => count + glassProbes(part).length, 0);

export function assertGlassPixelReview(parts, rows) {
  const panes = new Map(parts.map(p => [p.name, p]));
  assert.equal(panes.size, parts.length, "Distinct glass pane names required");
  assert.equal(rows?.length, glassProbeCount(parts) * 2, "Validate both sides of every measured pane");
  const seen = new Set();
  for (const row of rows) {
    const part = panes.get(row.name), key = row.name + ":" + row.probeKey + ":" + row.side;
    const probe = part && glassProbes(part).find(p => p.key === row.probeKey);
    assert.ok(probe && [-1, 1].includes(row.side) && !seen.has(key), "Missing or duplicate glass side");
    seen.add(key);
    assert.deepEqual(row.probeMM, probe.pointMM, "Glass probe changed after QA");
    assert.equal(row.colourReviewVersion, 1, "Regenerate palette-aware glass QA");
    assert.deepEqual(row.recipeRGB, part.rgb, "Glass palette changed after QA");
    const expected = expectedGlassRGB(part.rgb);
    rgb(row.expectedPackedRGB);
    assert.ok(expected.every((v, i) => Math.abs(v - row.expectedPackedRGB[i]) < 1e-9));
    const error = glassChromaticityError(row.sampledRGB, expected);
    assert.ok(Number.isFinite(error) && error <= GLASS_CHROMATICITY_TOLERANCE, "Glass pigment differs from its measured palette");
    const brightness = row.sampledRGB.reduce((s, v) => s + v, 0) / expected.reduce((s, v) => s + v, 0);
    assert.ok(brightness >= 0.75 && brightness <= 1.25, "Glass pigment lost brightness");
    assert.ok(Math.abs(error - row.chromaticityError) < 1e-9, "Glass colour evidence changed");
    assert.ok(Number.isFinite(row.deviationMM) && row.deviationMM >= 0 && row.deviationMM <= 0.15 &&
      Number.isFinite(row.normalFacing) && row.normalFacing >= 0.5, "Glass pane lost shape or facing");
  }
}
