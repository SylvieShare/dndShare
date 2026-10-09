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
test("false pit mounting is removed only with an explicit incompatible source-body correction", () => {
  const old = {
    ...model,
    definitionId: "LC-034",
    sourceCode: "LC-034",
    code: "LC-rocks-hole",
    mountDepth: 0.146946,
    canStand: true,
    width: 1,
    height: 1,
    placementPoints: [{ x: 0.5, y: 0.5, elevation: 0.146962 }],
    supportSlots: [],
  };
  const src = { ...source, mountDepth: 0.146946, max: [17.5, 17.5, 29.6408] };
  const s = {
    geometryCorrection: {
      mode: "remove-false-mount",
      sourceSHA256: sha,
      previousCutHeightMM: 11.5,
      cutHeightMM: 11.5,
      reason:
        "Restore native pit and low boulders hidden by a false universal solid mounting pyramid.",
      metadata: {
        mountDepth: 0.146946,
        canStand: false,
        placementPoints: [],
        tileType: "floor",
        maxHeight: (29.6408 - 11.5) / 35,
        surfaceHeight: 14.6 / 35,
      },
    },
  };
  const corrected = correctedCaveModel(old, src, s, true);
  assert.equal(corrected.cutHeight, 11.5);
  assert.equal(corrected.model.mountDepth, 0.146946);
  assert.equal(
    correctedCaveModel({ ...old, mountDepth: 0 }, src, s, true).model
      .mountDepth,
    0.146946,
  );
  assert.deepEqual(corrected.model.assets, old.assets);
  assert.equal(corrected.model.definitionId, "LC-034");
  assert.throws(() => correctedCaveModel(old, src, s, false));
  for (const mutate of [
    (v) => (v.geometryCorrection.metadata.mountDepth = 0.1),
    (v) => (v.geometryCorrection.metadata.canStand = true),
    (v) =>
      (v.geometryCorrection.metadata.placementPoints = [
        { x: 0.5, y: 0.5, elevation: 0.1 },
      ]),
    (v) => (v.geometryCorrection.cutHeightMM = 0),
    (v) => (v.geometryCorrection.rotationXDeg = 180),
    (v) => (v.geometryCorrection.mode = "other"),
  ]) {
    const changed = structuredClone(s);
    mutate(changed);
    assert.throws(() => correctedCaveModel(old, src, changed, true));
  }
  assert.throws(() =>
    correctedCaveModel({ ...old, supportSlots: [{}] }, src, s, true),
  );
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
test("upside-down print restoration requires measured points and a declared180 degree orientation", () => {
  const placed = {
    ...model,
    width: 1,
    height: 1,
    placementPoints: [{ x: 0.5, y: 0.5, elevation: 0.1 }],
  };
  const s = structuredClone(spec);
  s.geometryCorrection.rotationXDeg = 180;
  assert.throws(() => correctedCaveModel(placed, source, s, true));
  s.geometryCorrection.metadata.placementPoints = [
    { x: 0.5, y: 0.5, elevation: 0.2 },
  ];
  const corrected = correctedCaveModel(placed, source, s, true);
  assert.equal(corrected.correction.rotationOriginZMM, source.max[2]);
  assert.equal(corrected.model.placementPoints[0].elevation, 0.2);
  s.geometryCorrection.rotationXDeg = 90;
  assert.throws(() => correctedCaveModel(placed, source, s, true));
  s.geometryCorrection.rotationXDeg = 180;
  s.geometryCorrection.metadata.placementPoints[0].elevation = 1;
  assert.throws(() => correctedCaveModel(placed, source, s, true));
});

test("native bridge crop restoration retains bridge identity and requires measured replacement points", () => {
  const current = {
    ...model,
    tileType: "bridge",
    width: 1,
    height: 3,
    supportSlots: [],
    placementPoints: [{ x: 0.5, y: 0.5, elevation: 0.421143 }],
  };
  const src = { ...source, mountDepth: 0, max: [17.5, 52.5, 48.6675] };
  const s = {
    geometryCorrection: {
      mode: "restore-native-bridge",
      sourceSHA256: sha,
      previousCutHeightMM: 11.5,
      cutHeightMM: 0,
      reason:
        "Restore the native bridge stone and end keys removed by an incorrect universal mounting cut.",
      metadata: {
        tileType: "bridge",
        maxHeight: 48.6675 / 35,
        surfaceHeight: 17.9494 / 35,
        placementPoints: [{ x: 0.5, y: 0.5, elevation: 17.9494 / 35 }],
      },
    },
  };
  const corrected = correctedCaveModel(current, src, s, true);
  assert.equal(corrected.model.tileType, "bridge");
  assert.equal(corrected.model.id, current.id);
  assert.equal(corrected.cutHeight, 0);
  assert.throws(() => correctedCaveModel(current, src, s, false));
  assert.throws(() =>
    correctedCaveModel({ ...current, tileType: "floor" }, src, s, true),
  );
  assert.throws(() =>
    correctedCaveModel(current, { ...src, mountDepth: 0.15 }, s, true),
  );
  assert.throws(() =>
    correctedCaveModel({ ...current, supportSlots: [{}] }, src, s, true),
  );
  const rotated = structuredClone(s);
  rotated.geometryCorrection.rotationXDeg = 180;
  assert.throws(() => correctedCaveModel(current, src, rotated, true));
  const missing = structuredClone(s);
  delete missing.geometryCorrection.metadata.placementPoints;
  assert.throws(() => correctedCaveModel(current, src, missing, true));
});
