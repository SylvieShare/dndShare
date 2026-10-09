import test from "node:test";
import assert from "node:assert/strict";
import { reviewedCaveFootprint } from "./reviewed_cave_footprint.mjs";
const model = {
  width: 1,
  height: 1,
  mountDepth: 0.149446,
  assets: { source: { sha256: "a".repeat(64) } },
};
const profile = {
  sourceSHA256: "a".repeat(64),
  mountDepthMM: 0.149446 * 35,
  sourceTopWidthMM: 35,
  centresMM: [[0, 0]],
  reason:
    "Native35mm taper needs one centred mounting pyramid instead of ambiguous overlapping old blocks.",
};
test("native footprint uses one original cell while preserving depth and source identity", () => {
  const a = reviewedCaveFootprint(profile, model);
  assert.equal(a.pads.length, 1);
  assert.deepEqual(a.pads[0].top, { min: [-0.5, -0.5], max: [0.5, 0.5] });
  assert.equal(a.signature.length, 64);
  assert.equal(reviewedCaveFootprint(undefined, model), undefined);
  for (const change of [
    (p) => (p.sourceSHA256 = "b".repeat(64)),
    (p) => (p.mountDepthMM = 1),
    (p) => delete p.mountDepthMM,
    (p) => (p.reason = "guess"),
    (p) => (p.sourceTopWidthMM = 26),
    (p) =>
      (p.centresMM = [
        [0, 0],
        [0, 0],
      ]),
    (p) => (p.centresMM = [[35, 0]]),
  ]) {
    const p = structuredClone(profile);
    change(p);
    assert.throws(() => reviewedCaveFootprint(p, model));
  }
  assert.throws(() =>
    reviewedCaveFootprint(profile, { ...model, width: undefined }),
  );
});
test("larger reviewed footprint allows distinct grid centres, not overlapping off-grid pads", () => {
  const m = { ...model, width: 1, height: 3 };
  assert.equal(
    reviewedCaveFootprint(
      {
        ...profile,
        centresMM: [
          [0, -35],
          [0, 35],
        ],
      },
      m,
    ).pads.length,
    2,
  );
  assert.throws(() =>
    reviewedCaveFootprint({ ...profile, centresMM: [[0, 1]] }, m),
  );
});
