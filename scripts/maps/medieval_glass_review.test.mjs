import test from "node:test";
import assert from "node:assert/strict";
import { expectedGlassRGB, glassChromaticityError, assertGlassPixelReview } from "./medieval_glass_review.mjs";

function fixture(colour) {
  const parts = [{ name: "Measured pane", rgb: colour, probeMM: [0, 0, 0] }], expected = expectedGlassRGB(colour);
  const rows = [-1, 1].map(side => ({
    name: parts[0].name, probeKey: "centre", probeMM: [0, 0, 0], side, colourReviewVersion: 1, recipeRGB: colour,
    expectedPackedRGB: expected, sampledRGB: expected, chromaticityError: 0,
    deviationMM: 0.01, normalFacing: 0.99,
  }));
  return { parts, rows };
}

test("glass review accepts measured green and amber palettes", () => {
  for (const colour of [[0.48, 0.59, 0.17], [0.78, 0.55, 0.08]]) {
    const { parts, rows } = fixture(colour);
    assertGlassPixelReview(parts, rows);
  }
  const { parts, rows } = fixture([0.48, 0.59, 0.17]);
  rows[0].sampledRGB = [0.4639398578, 0.5698222045, 0.1649067486];
  rows[0].chromaticityError = glassChromaticityError(rows[0].sampledRGB, rows[0].expectedPackedRGB);
  assertGlassPixelReview(parts, rows); // An actual packed MT1-040 sample.
});

test("wrong pigment, missing sides and stale evidence cannot pass a glass review", () => {
  for (const bad of [[0.4, 0.4, 0.4], [0.5, 0.28, 0.1], [0.2, 0.6, 0.15], [0, 0, 0]]) {
    const { parts, rows } = fixture([0.78, 0.55, 0.08]);
    rows[0].sampledRGB = bad;
    rows[0].chromaticityError = glassChromaticityError(bad, rows[0].expectedPackedRGB);
    assert.throws(() => assertGlassPixelReview(parts, rows));
  }
  for (const change of [
    rows => { rows[1].side = -1; },
    rows => { rows[0].recipeRGB = [0.5, 0.6, 0.2]; },
    rows => { rows[0].deviationMM = 0.151; },
    rows => { rows[0].normalFacing = 0.49; },
    rows => { delete rows[0].colourReviewVersion; },
    rows => { rows[0].chromaticityError = 0.01; },
    rows => { rows[0].probeMM = [0, 0, 1]; },
    rows => { rows[0].sampledRGB = rows[0].expectedPackedRGB.map(v => v * 0.1); },
  ]) {
    const { parts, rows } = fixture([0.78, 0.55, 0.08]);
    change(rows);
    assert.throws(() => assertGlassPixelReview(parts, rows));
  }
});

test("a continuous sheet still verifies every separately measured opening", () => {
  const { parts, rows } = fixture([0.78, 0.55, 0.08]);
  parts[0].probesMM = [{ key: "left", pointMM: [-2, 0, 5] }, { key: "right", pointMM: [2, 0, 5] }];
  const samples = parts[0].probesMM.flatMap(probe => rows.map(row => ({ ...row, probeKey: probe.key, probeMM: probe.pointMM })));
  assertGlassPixelReview(parts, samples);
  assert.throws(() => assertGlassPixelReview(parts, samples.slice(1)));
  samples[3] = { ...samples[2] };
  assert.throws(() => assertGlassPixelReview(parts, samples));
});
