import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import {
  minePartAt,
  paintCaveMine,
  mineProjectionAt,
} from "./lost_cave_mine.mjs";
const s = specs["LC-073"];
test("mine posts, inclined braces and horizontal sleepers follow their own measured timber axes", () => {
  for (const p of [
    [-13.3519, -17.5003, 33.5124],
    [-10.5052, 12.9272, 35.1129],
    [-11.4318, 11.8447, 27.3445],
  ])
    assert.equal(minePartAt(p, [1, 0, 0], s).member.name, "post");
  for (const p of [
    [-7.6095, -16.5515, 26.7632],
    [-3.9023, -15.8266, 22.7805],
    [-2.3149, 13.7521, 20.3099],
    [0.0451, 13.7533, 17.803],
  ])
    assert.equal(minePartAt(p, [0, -1, 0], s).member.name, "brace");
  assert.equal(
    minePartAt([8.7178, 13.8908, 15.2374], [0, 0, 1], s).member.name,
    "sleeper",
  );
  for (const p of [
    [-6.6328, 13.7722, 22.5218],
    [-3.8484, 13.7687, 19.8522],
    [-1.9059, 13.7637, 18.1089],
    [-1.6739, -17.0801, 17.4054],
    [-10.0416, 15.6264, 30.7075],
    [-7.0467, 13.7613, 22.3607],
    [-2.6679, 13.7683, 17.7982],
    [-10.1607, 15.4358, 30.7692],
    [-10.363, 15.6039, 31.0968],
  ])
    assert.equal(minePartAt(p, [0, -1, 0], s).member?.name, "brace");
  assert.equal(
    minePartAt([-7.3591, -12.7027, 15.5393], [0, 0, 1], s).part,
    "boulder",
  );
});
test("rejected projected iron on a long board still resolves the wood contour", () => {
  const m = specs["LC-075"].mine;
  assert.equal(
    mineProjectionAt(
      [1.8753, 7.8671, 16.4892],
      m,
      () => ({ part: "iron" }),
      () => ({ part: "wood" }),
    ).part,
    "wood",
  );
  assert.equal(
    mineProjectionAt(
      [3.934, 10.1502, 18.3736],
      m,
      () => ({ part: "iron" }),
      () => ({ part: "wood" }),
    ).part,
    "iron",
  );
});
test("mine stone and brown floor stay separate without fictitious metal at wooden knots", () => {
  assert.equal(
    minePartAt([-11.1439, 2.5431, 23.1131], [1, 0, 0], s).part,
    "boulder",
  );
  assert.equal(
    minePartAt([2.6111, 6.1317, 14.7064], [0, 0, 1], s).part,
    "rock",
  );
  assert.equal(s.mine.bolts.length, 0);
  const stone = paintCaveMine([-11, 0, 25], [1, 0, 0], 230, s);
  assert.equal(stone.metallic, 0);
  assert(stone.rgb[1] > stone.rgb[0]);
  const wood = paintCaveMine([-14, -14.5, 25], [1, 0, 0], 230, s);
  assert.equal(wood.metallic, 0);
  assert.equal(wood.part, "wood");
});
test("LC-074 contains only measured posts, leaving the missing braces as stone or floor", () => {
  const s = specs["LC-074"];
  assert.equal(s.mine.members.length, 2);
  for (const p of [
    [-13.6013, -17.4991, 32.816],
    [-10.4228, 13.6511, 27.1278],
    [-11.0725, 11.6938, 19.5546],
  ])
    assert.equal(minePartAt(p, [1, 0, 0], s).member?.name, "post");
  assert.equal(
    minePartAt([-8.2425, 11.9858, 15.5519], [0, 0, 1], s).part,
    "boulder",
  );
  assert.equal(
    minePartAt([0.6955, 6.5774, 14.9388], [0, 0, 1], s).part,
    "rock",
  );
  assert.equal(minePartAt([-3, 15.5, 22], [0, 1, 0], s).part, "boulder");
});
test("LC-075 protects its bare floor reference while separating raised iron from board grain", () => {
  const s = specs["LC-075"],
    added = { distanceAt: () => 1 },
    bare = { distanceAt: () => 0.05 };
  const board = [1.3804, 0.0775, 16.38];
  assert.throws(() => minePartAt(board, [0, 0, 1], s));
  assert.equal(minePartAt(board, [0, 0, 1], s, added).part, "wood");
  assert.equal(minePartAt(board, [0, 0, 1], s, bare).part, "boulder");
  assert.equal(
    minePartAt([-13.6013, -17.4991, 32.816], [1, 0, 0], s, bare).part,
    "wood",
  );
  const head = [3.934, 10.1502, 18.3736];
  const metal = paintCaveMine(head, [0, 0.82, 0.55], 235, s, added, () => ({
    part: "iron",
  }));
  assert.equal(metal.part, "iron");
  assert(metal.metallic > 0.6);
  assert.equal(
    minePartAt(head, [0, 0.82, 0.55], s, bare, () => ({ part: "iron" })).part,
    "boulder",
  );
  const visible = (p) => undefined;
  visible.isVisible = (p) => true;
  assert.equal(minePartAt(board, [0, 0, 1], s, added, visible).part, "boulder");
  const wood = (p) => ({ part: "wood" });
  wood.isVisible = (p) => true;
  assert.equal(minePartAt(board, [0, 0, 1], s, added, wood).part, "wood");
  assert.equal(
    minePartAt(
      [-4.2716, -9.3577, 16.0564],
      [0, 0, 1],
      s,
      { distanceAt: () => 0.128 },
      wood,
    ).part,
    "wood",
  );
});
