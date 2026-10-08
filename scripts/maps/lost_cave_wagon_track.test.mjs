import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import {
  wagonOnTrackPartAt,
  paintWagonOnTrack,
  wagonLocalPoint,
} from "./lost_cave_wagon_track.mjs";
test("compound wagon matches its3D body reference while preserving track stone and timber", () => {
  const s = specs["LC-028"];
  const r = {
    spec: { low: [0, 0, 0], step: 1, size: [1, 1, 1], scale: 255 },
    data: Buffer.from([0]),
  };
  assert.equal(wagonOnTrackPartAt([0, 0, s.wagonOffsetZMM], s, r), "wagon");
  assert.equal(wagonOnTrackPartAt([0, 0, 1], s, r), "track");
  assert.equal(
    paintWagonOnTrack([-14.7673, 0.6983, 14.7981], [0, 0, 1], 230, s, r).part,
    "rock",
  );
  assert.equal(
    paintWagonOnTrack([-1.2232, -13.2618, 16.8588], [0, 0, 1], 230, s, r).part,
    "wood",
  );
});
test("loaded wagon rotates only its reference and hardware, protecting the metal rim from cargo", () => {
  const s = specs["LC-029"];
  const point = [-9.7, -17.3, 47.8];
  assert.deepEqual(wagonLocalPoint(point, s), [
    9.7,
    17.3,
    47.8 - s.wagonOffsetZMM,
  ]);
  const local = wagonLocalPoint(point, s);
  const r = {
    spec: { low: local, step: 1, size: [1, 1, 1], scale: 255 },
    data: Buffer.from([0]),
  };
  assert.equal(wagonOnTrackPartAt(point, s, r), "wagon");
  assert.equal(paintWagonOnTrack(point, [0, 0, 1], 230, s, r).part, "brass");
  assert.equal(wagonOnTrackPartAt([6.3078, 12.4844, 52.2407], s, r), "crystal");
  assert.equal(
    paintWagonOnTrack([6.3078, 12.4844, 52.2407], [0, 0, 1], 230, s, r)
      .metallic,
    0,
  );
  assert.equal(wagonOnTrackPartAt([-13.8595, -16.933, 13.2411], s, r), "track");
});
