import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import { minePartAt, paintCaveMine } from "./lost_cave_mine.mjs";
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
