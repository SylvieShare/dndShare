import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { addFireboxBackstop, FIREBOX_BACKSTOP } from "./firebox_backstop.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { Document } = require("@gltf-transform/core");
const spec = {
  minMM: [-9.23, -9.4, 27.9],
  maxMM: [-9.03, 9.4, 47.2],
  measuredInnerWallMinXMM: -9,
  rgb: [0.16, 0.145, 0.12],
  roughness: 0.91,
};
test("backstop is closed, outward-facing and remains behind the surviving stone", () => {
  const d = new Document();
  d.createScene();
  const proof = addFireboxBackstop(d, spec, {
    mountCenterMM: [1, -2],
    nativeZShiftMM: 11.626905,
  });
  assert.equal(proof.triangles, 12);
  const p = d.getRoot().listMeshes()[0].listPrimitives()[0],
    a = p.getAttribute("POSITION"),
    idx = p.getIndices(),
    n = p.getAttribute("NORMAL"),
    edges = new Map();
  const source = (i) => {
    const v = a.getElement(i, []);
    return [v[0] * 35 + 1, -v[2] * 35 - 2, v[1] * 35 + 11.626905];
  };
  const key = (i) =>
    source(i)
      .map((v) => v.toFixed(4))
      .join(",");
  for (let i = 0; i < idx.getCount(); i += 3) {
    const ids = [0, 1, 2].map((j) => idx.getScalar(i + j)),
      q = ids.map(source),
      u = q[1].map((v, j) => v - q[0][j]),
      v = q[2].map((v, j) => v - q[0][j]),
      cross = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ],
      normal = n.getElement(ids[0], []),
      nativeNormal = [normal[0], -normal[2], normal[1]];
    assert.ok(cross.reduce((s, v, j) => s + v * nativeNormal[j], 0) > 0);
    for (let j = 0; j < 3; j++) {
      const x = key(ids[j]),
        y = key(ids[(j + 1) % 3]),
        k = [x, y].sort().join("|");
      const value = edges.get(k) || [];
      value.push([x, y]);
      edges.set(k, value);
    }
    for (const point of q)
      for (let j = 0; j < 3; j++)
        assert.ok(
          point[j] >= spec.minMM[j] - 0.00001 &&
            point[j] <= spec.maxMM[j] + 0.00001,
        );
  }
  for (const pair of edges.values()) {
    assert.equal(pair.length, 2);
    assert.deepEqual(pair[0], [...pair[1]].reverse());
  }
  const material = p.getMaterial();
  assert.equal(material.getMetallicFactor(), 0);
  assert.equal(material.getRoughnessFactor(), 0.91);
  assert.deepEqual(material.getEmissiveFactor(), [0, 0, 0]);
  assert.equal(material.getBaseColorTexture(), null);
});
test("adding a backstop preserves all existing body buffers and materials", () => {
  const d = new Document(),
    b = d.createBuffer(),
    a = d
      .createAccessor()
      .setType("VEC3")
      .setArray(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))
      .setBuffer(b),
    m = d.createMaterial("body"),
    p = d.createPrimitive().setAttribute("POSITION", a).setMaterial(m);
  d.createScene().addChild(
    d.createNode("body").setMesh(d.createMesh().addPrimitive(p)),
  );
  const before = Array.from(a.getArray());
  addFireboxBackstop(d, spec);
  assert.deepEqual(Array.from(a.getArray()), before);
  assert.equal(p.getMaterial(), m);
  assert.equal(
    d
      .getRoot()
      .listNodes()
      .filter((n) => n.getName() === FIREBOX_BACKSTOP).length,
    1,
  );
  assert.throws(() => addFireboxBackstop(d, spec), /already exists/);
});
test("rejects a panel in front of native stone or an excessive solid block", () => {
  for (const s of [
    { ...spec, maxMM: [-8.9, 9.4, 47.2] },
    { ...spec, minMM: [-11, -9.4, 27.9] },
  ]) {
    const d = new Document();
    d.createScene();
    assert.throws(() => addFireboxBackstop(d, s));
  }
});
