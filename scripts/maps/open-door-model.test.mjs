import test from "node:test";
import assert from "node:assert/strict";
import specs from "./open-doors.json" with { type: "json" };
import { rotateDoorPoint, openDoorModel } from "./open-door-model.mjs";
test("hinge stays fixed and vertical axis remains unchanged when the door opens", () => {
  const s = specs["UD-010"];
  assert.deepEqual(rotateDoorPoint([...s.hinge, 40], s), [...s.hinge, 40]);
  const p = rotateDoorPoint([12.95, 14.5, 45], s);
  assert.ok(Math.abs(p[0] + 16.05) < 1e-8);
  assert.ok(Math.abs(p[1] + 14.5) < 1e-8);
  assert.equal(p[2], 45);
});
test("open variant preserves mounting and leaves the central passage clear", () => {
  const p = {
    id: "original",
    sourceCode: "UD-010",
    name: "Door",
    sourceName: "Door",
    version: 7,
    width: 1,
    height: 1,
    mountDepth: 0.149137,
    surfaceHeight: 0.421143,
    maxHeight: 1.900549,
    placementOffset: [0, 0],
    placementPoints: [{ x: 0.5, y: 0.5, elevation: 0.406159 }],
    supportSlots: [],
    tags: [],
    assets: { source: { sha256: "original" } },
    blockers: [],
  };
  const m = openDoorModel(p, specs["UD-010"]);
  assert.equal(m.sourceCode, "UD-010-OPEN");
  assert.equal(m.version, undefined);
  assert.equal(p.id, "original");
  assert.equal(p.assets.source.sha256, "original");
  for (const k of [
    "width",
    "height",
    "mountDepth",
    "surfaceHeight",
    "maxHeight",
    "placementOffset",
    "placementPoints",
    "supportSlots",
  ])
    assert.deepEqual(m[k], p[k]);
  for (const poly of m.blockers) {
    assert.ok(poly.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1));
    let minY = Math.min(...poly.map((p) => p[1])),
      maxY = Math.max(...poly.map((p) => p[1]));
    assert.ok(
      0.5 < minY || 0.5 > maxY,
      "central passage must remain unblocked",
    );
  }
  assert.throws(() => openDoorModel(p, { ...specs["UD-010"], code: "UD-010" }));
});
