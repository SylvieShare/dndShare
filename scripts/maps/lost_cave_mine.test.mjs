import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import {
  minePartAt,
  paintCaveMine,
  mineProjectionAt,
} from "./lost_cave_mine.mjs";
const s = specs["LC-073"];
test("LC-083 ring guards exclude both wooden backgrounds and keep horizontal rails separate from vertical boards", () => {
  const s = specs["LC-083"],
    iron = () => ({ part: "iron" });
  for (const p of [
    [-11.5519, 5.1087, 32.6274],
    [-16.9969, 5.8785, 33.9377],
    [-11.7831, -14.5398, 28.5327],
  ])
    assert.equal(minePartAt(p, [1, 0, 0], s, undefined, iron).part, "iron");
  for (const p of [
    [-12.4657, 8.3788, 31.1187],
    [-15.9404, 6.93, 40.24],
  ])
    assert.equal(minePartAt(p, [1, 0, 0], s, undefined, iron).part, "wood");
  assert.equal(
    minePartAt([-17.03, -1.8873, 17.5884], [1, 0, 0], s).member.name,
    "lower-rail",
  );
  assert.equal(
    minePartAt([-12.4686, -5.5431, 20.9558], [1, 0, 0], s).member.name,
    "vertical-boards",
  );
});
test("LC-082 keeps its Y header and opposing braces wooden below the separate iron plate", () => {
  const s = specs["LC-082"];
  for (const p of [
    [-7.2582, -8.6979, 64.142],
    [-9.5881, -15.6989, 64.108],
  ])
    assert.equal(minePartAt(p, [0, 0, 1], s).member.name, "head-beam");
  assert.equal(
    minePartAt([-6.0939, -6.3887, 48.9128], [1, 0, 0], s).member.name,
    "long-brace",
  );
  assert.equal(
    minePartAt([-6.6982, 6.8071, 54.2695], [1, 0, 0], s).member.name,
    "short-brace",
  );
  for (const p of [
    [-12.4504, 5.7817, 64.9465],
    [-7.2015, 13.0294, 65.024],
    [-11.4193, -12.3778, 71.4541],
    [-11.4083, -1.3603, 71.9871],
    [-11.1944, 10.0797, 71.1087],
  ])
    assert.equal(minePartAt(p, [0, 0, 1], s).part, "iron");
  for (const p of [
    [-4.2487, -14.9052, 41.063],
    [-14.7085, 9.9646, 26.8845],
    [-8.1111, 10.1347, 30.3264],
  ])
    assert.equal(
      minePartAt(p, [1, 0, 0], s, undefined, () => ({ part: "iron" })).part,
      "iron",
    );
  const metal = paintCaveMine([-11.1217, -4.44, 65.2297], [0, 0, 1], 230, s);
  assert(metal.rgb[0] < 120);
  assert(metal.metallic > 0.6);
});
test("LC-081 timber follows its own horizontal, tall and inclined members while hex heads stay separate", () => {
  const s = specs["LC-081"];
  for (const p of [
    [-9.5099, -15.4171, 64.0823],
    [5.6914, -16.2936, 64.0641],
  ])
    assert.equal(minePartAt(p, [0, 0, 1], s).member.name, "head-beam");
  for (const p of [
    [-7.2979, -15.9604, 47.4576],
    [-1.0089, -16.4126, 52.2142],
    [-7.455, 11.1015, 47.7838],
    [-5.2331, 11.3851, 54.7414],
  ])
    assert.equal(minePartAt(p, [0, -1, 0], s).member.name, "upper-brace");
  assert.equal(
    minePartAt([-14.5053, 10.5112, 53.435], [0, -1, 0], s).member.name,
    "post",
  );
  for (const p of [
    [-12.5612, -15.1607, 65.3453],
    [5.6615, -15.269, 65.0713],
    [-12.8648, 12.604, 65.4391],
    [5.8802, 13.2246, 65.1863],
    [-9.9111, -15.8275, 37.8314],
  ])
    assert.equal(
      minePartAt(p, [0, 0, 1], s, undefined, () => ({ part: "iron" })).part,
      "iron",
    );
  assert.equal(
    minePartAt([-9.5099, -15.4171, 64.0823], [0, 0, 1], s, undefined, () => ({
      part: "iron",
    })).part,
    "wood",
  );
});
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
test("LC-078 bone silhouettes apply aged nonmetal ivory while mine stone keeps its own palette", () => {
  const s = specs["LC-078"],
    p = [-6.4403, 7.255, 29.218];
  const b = paintCaveMine(p, [0, 0, 1], 230, s, {
    projectedBoneAt: () => true,
  });
  assert.equal(b.part, "bone");
  assert.equal(b.metallic, 0);
  assert(b.rgb[0] > b.rgb[2]);
  const stone = paintCaveMine([0, 8, 25], [0, -1, 0], 230, s, {
    projectedBoneAt: () => false,
  });
  assert.equal(stone.part, "boulder");
  assert(stone.rgb[1] > stone.rgb[0]);
  const old = paintCaveMine([-5, -7.6, 18.5], [0, 0, 1], 210, s, {
    projectedBoneAt: () => true,
  });
  assert.notDeepEqual(b.rgb, old.rgb);
  assert.equal(
    paintCaveMine([-9.5, 9, 37], [1, 0, 0], 230, s, {
      projectedBoneAt: () => true,
    }).part,
    "wood",
  );
  assert.equal(
    paintCaveMine([-7.7837, 0.6482, 24.8024], [0, 0, 1], 230, s, {
      projectedBoneAt: () => true,
    }).part,
    "bone",
  );
  assert.equal(
    paintCaveMine([-7.8653, 5.4464, 25.8514], [0, 0, 1], 230, s, {
      projectedBoneAt: () => true,
    }).part,
    "boulder",
  );
});
test("LC-077 has its measured wide corner and rotated third post without wood across the floor", () => {
  const s = specs["LC-077"];
  for (const p of [
    [-9.553, 8.5663, 35.5645],
    [-11.0698, 8.2044, 30.0959],
    [-8.1097, 8.9127, 17.9714],
    [14.3122, 10.8465, 36.4705],
    [11.0472, 12.2549, 20.245],
    [-7.8305, 10.0744, 30.3393],
    [-7.8325, 10.3176, 22.3513],
  ])
    assert.equal(minePartAt(p, [1, 0, 0], s).part, "wood");
  assert.equal(
    minePartAt([6.1674, -6.0248, 14.707], [0, 0, 1], s).part,
    "rock",
  );
  assert.equal(minePartAt([0, 12, 25], [0, -1, 0], s).part, "boulder");
});
test("LC-076 tool shafts follow measured axes and stay separate from iron working faces", () => {
  const s = specs["LC-076"];
  for (const p of [
    [-0.6393, -5.0961, 30.1534],
    [2.3401, -7.7799, 24.2119],
    [4.6222, -9.2297, 20.7375],
    [5.1069, 6.0635, 25.364],
    [7.0392, 6.1363, 23.4785],
  ])
    assert.equal(minePartAt(p, [0, 0, 1], s).part, "wood");
  for (const p of [
    [1.2152, -13.986, 18.1338],
    [8.4512, -7.5978, 18.5605],
    [6.8604, -11.3379, 16.6964],
    [13.4574, 6.5641, 16.6836],
    [14.4235, 4.7001, 16.993],
  ])
    assert.equal(minePartAt(p, [0, 0, 1], s).part, "iron");
  assert.equal(
    minePartAt([0.8972, 7.022, 29.1597], [0, 0, 1], s, undefined, () => ({
      part: "grip",
    })).part,
    "grip",
  );
  assert.equal(
    minePartAt([0.8972, 7.022, 29.1597], [0, 0, 1], s).part,
    "boulder",
  );
  assert.equal(
    minePartAt([-7.0341, -8.1177, 25.1741], [0, 0, 1], s).part,
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
