import test from "node:test";
import assert from "node:assert/strict";
import specs from "./lost_cave_recipes.mjs";
import {
  scaffoldRampPartAt,
  paintScaffoldingRamp,
} from "./lost_cave_scaffolding_ramp.mjs";
import { scaffoldMemberBasis } from "./scaffold_member_geometry.mjs";
const s = specs["LC-062"];
test("outer and central ramp members follow separately measured pitches while rear posts stay vertical", () => {
  const outside = scaffoldRampPartAt(
    [-8.204, -14.4968, 19.5239],
    [-0.7068, 0.0017, 0.7074],
    s,
  );
  const centre = scaffoldRampPartAt(
    [-4.5415, 0.0059, 19.9364],
    [-0.7629, -0.0018, 0.6465],
    s,
  );
  assert.equal(outside.part, "wood");
  assert.equal(centre.part, "wood");
  const a = scaffoldMemberBasis(outside.member).a,
    b = scaffoldMemberBasis(centre.member).a;
  assert(Math.abs(a[2] / a[0] - 1) < 0.001);
  assert(Math.abs(b[2] / b[0] - 1.17) < 0.001);
  assert.equal(
    scaffoldRampPartAt(
      [-4.3779, -3.0493, 19.5019],
      [-0.4754, -0.7884, 0.3903],
      s,
    ).part,
    "wood",
  );
  const post = scaffoldRampPartAt(
    [15.9824, -15.1092, 24.3098],
    [0.4309, 0.9021, 0.0248],
    s,
  );
  assert.equal(post.member.axis, "z");
  const brace = scaffoldRampPartAt(
    [14.9976, -8.105, 25.0603],
    [0.4051, -0.8227, 0.3989],
    s,
  );
  assert.equal(brace.member.name, "rear-brace");
  for (const [p, n] of [
    [
      [10.4061, -8, 25.1],
      [-0.9682, 0.1853, -0.1678],
    ],
    [
      [9.5765, 8, 25.1],
      [-0.994, -0.0378, 0.103],
    ],
    [
      [11.1768, -5, 33.2],
      [-0.9937, 0.0639, 0.0922],
    ],
    [
      [10.5331, 5, 33.2],
      [-0.9936, -0.0583, 0.0972],
    ],
  ])
    assert.equal(scaffoldRampPartAt(p, n, s).member?.name, "rear-brace");
  for (const [p, n] of [
    [
      [11.4033, 15, 18],
      [-1, 0, 0],
    ],
    [
      [11.478, -15, 24.2],
      [-0.6332, -0.7739, -0.0111],
    ],
    [
      [11.4041, 15, 24.2],
      [-1, 0.0026, 0.0006],
    ],
    [
      [9.4558, -15, 18],
      [-0.7194, -0.5568, 0.4152],
    ],
    [
      [7.34, -15, 28],
      [0.714, -0.0132, -0.7],
    ],
    [
      [7.3422, 15, 28],
      [0.7071, -0.0004, -0.7071],
    ],
  ])
    assert.equal(scaffoldRampPartAt(p, n, s).part, "wood");
  for (const p of [
    [2.0646, 0, 20],
    [8.849, 0, 28],
  ])
    assert.equal(scaffoldRampPartAt(p, [0.7626, 0, -0.6469], s).part, "wood");
  const header = scaffoldRampPartAt([17.3796, 0, 39.9193], [1, 0, 0], s);
  assert.equal(header.member.axis, "y");
});
test("eight oriented hex heads and their sides are iron without converting neighbouring carved timber or ground", () => {
  const bolts = s.scaffolding.ramp.bolts;
  assert.equal(bolts.length, 8);
  for (const bolt of bolts) {
    assert.equal(scaffoldRampPartAt(bolt.centre, bolt.normal, s).part, "iron");
    const side = bolt.centre.map(
      (v, i) => v - 0.4 * bolt.normal[i] + 0.7 * bolt.u[i],
    );
    assert.equal(scaffoldRampPartAt(side, bolt.u, s).part, "iron");
  }
  assert.equal(
    scaffoldRampPartAt([-15.3825, 10.7091, 15.608], [0.0399, 0.203, 0.9784], s)
      .part,
    "wood",
  );
  for (const [p, n] of [
    [
      [-7.325, 8.5914, 12.3712],
      [0.5997, 0.2935, 0.7445],
    ],
    [
      [9.6338, -8.3332, 13.4779],
      [-0.2077, -0.0354, 0.9776],
    ],
  ])
    assert.equal(scaffoldRampPartAt(p, n, s).part, "rock");
  for (const [p, n] of [
    [
      [1.6115, -6.2764, 11.3672],
      [0, 0.0234, 0.9997],
    ],
    [
      [-12.2327, 5.6634, 11.3689],
      [0, 0, 1],
    ],
    [
      [-15.2746, 14.1977, 16.2116],
      [0.1303, -0.1089, 0.9855],
    ],
    [
      [-15.7517, -14.921, 16.1576],
      [-0.0302, 0.0107, 0.9995],
    ],
  ])
    assert.equal(scaffoldRampPartAt(p, n, s).part, "wood");
  const metal = paintScaffoldingRamp(bolts[0].centre, bolts[0].normal, 240, s);
  assert(metal.metallic > 0.5);
  const wood = paintScaffoldingRamp(
    [-4.5415, 0.0059, 19.9364],
    [-0.7629, -0.0018, 0.6465],
    240,
    s,
  );
  assert.equal(wood.metallic, 0);
});
