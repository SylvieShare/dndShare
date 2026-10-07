import test from "node:test";
import assert from "node:assert/strict";
import { correctedCaveModel } from "./lost_cave_correction.mjs";
const sha = "a".repeat(64);
const model = {
  id: "version-old",
  definitionId: "LC-026",
  code: "LC-crystals-for-wagon",
  sourceCode: "LC-026",
  sourceName: "Crystals for Wagon",
  mountDepth: 0,
  tileType: "floor",
  assets: { source: { sha256: sha } },
  maxHeight: 0.16,
};
const source = { sourceSHA256: sha, cutHeight: 11.5, max: [15, 14, 17.1222] };
const spec = {
  geometryCorrection: {
    sourceSHA256: sha,
    previousCutHeightMM: 11.5,
    cutHeightMM: 0,
    reason:
      "Restore the complete original crystal insert after the universal cut removed its body.",
    metadata: {
      tileType: "object",
      maxHeight: 17.1222 / 35,
      surfaceHeight: 17.1222 / 35,
    },
  },
};
test("reviewed crop restoration retains logical ID and original file while correcting full object height", () => {
  const result = correctedCaveModel(model, source, spec, true);
  assert.equal(result.cutHeight, 0);
  assert.equal(result.model.definitionId, model.definitionId);
  assert.deepEqual(result.model.assets, model.assets);
  assert.equal(result.model.tileType, "object");
  assert.equal(model.tileType, "floor");
});
test("ordinary recipes retain their cut, and restoration cannot silently override identity or another source", () => {
  assert.equal(correctedCaveModel(model, source, {}, false).cutHeight, 11.5);
  assert.throws(() => correctedCaveModel(model, source, spec, false));
  for (const change of [
    (s) => (s.geometryCorrection.sourceSHA256 = "b".repeat(64)),
    (s) => (s.geometryCorrection.metadata.definitionId = "LC-other"),
    (s) => (s.geometryCorrection.metadata.maxHeight = 0.7),
    (s) => (s.geometryCorrection.metadata.maxHeight = NaN),
    (s) => (s.geometryCorrection.cutHeightMM = 2),
    (s) => (s.geometryCorrection.reason = "fix"),
    (s) => delete s.geometryCorrection.reason,
  ]) {
    const changed = structuredClone(spec);
    change(changed);
    assert.throws(() => correctedCaveModel(model, source, changed, true));
  }
  assert.throws(() =>
    correctedCaveModel({ ...model, mountDepth: 0.15 }, source, spec, true),
  );
});
