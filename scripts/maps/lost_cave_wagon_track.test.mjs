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
test("tilted wagon protects its empty diagonal floor and lower rim while coloring the reduced stone load", () => {
  const s = specs["LC-031"];
  const r = {
    spec: { low: [0, 0, 0], step: 1, size: [1, 1, 1], scale: 255 },
    data: Buffer.from([255]),
  };
  for (const p of [
    [-0.562, 11.1488, 42.1683],
    [-1.7195, 11.0197, 45.2954],
    [13.6507, -15.5656, 39.3386],
    [14.525, -0.1638, 33.5454],
    [15.9955, -5.1695, 33.5025],
  ])
    assert.equal(wagonOnTrackPartAt(p, s, r), "wagon");
  for (const p of [
    [-0.9822, 6.2503, 42.2079],
    [5.0173, 3.1984, 37.8732],
    [12.9734, -8.3008, 39.5358],
    [16.1599, -10.2476, 38.5391],
  ])
    assert.equal(wagonOnTrackPartAt(p, s, r), "boulder");
  for (const p of [
    [9.541, 13.7293, 42.1536],
    [6.6501, -15.1355, 39.4402],
  ])
    assert.equal(wagonOnTrackPartAt(p, s, r), "wagon");
  assert.equal(
    paintWagonOnTrack([8.4684, 17.3597, 38.1309], [0, 1, 0], 230, s, r).part,
    "brass",
  );
  assert.equal(
    paintWagonOnTrack([-9.9142, 17.1998, 51.2611], [1, 0, 0], 230, s, r).part,
    "hardware",
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
