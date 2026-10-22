import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { addCandleWaxCaps, CANDLE_WAX_CAP } from "./candle_wax_cap.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { Document } = require("@gltf-transform/core");
const spec = {
  key: "candle", centreMM: [-.25, 13], radiiMM: [1.2, 1.25],
  bottomMM: 61.3, topMM: 61.4, measuredWaxRimMinMM: 61.5,
  measuredRimSamples: 100, measurementSourceSHA256: "a".repeat(64),
  rgb: [.82, .75, .48], roughness: .86,
};

test("wax cap is closed, outward-facing, nonemissive and below the measured rim", () => {
  const doc = new Document(); doc.createScene();
  const proof = addCandleWaxCaps(doc, [spec], { mountCenterMM: [1, -2], nativeZShiftMM: 11.626905 });
  assert.equal(proof[0].triangles, 128);
  const primitive = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const position = primitive.getAttribute("POSITION"), normal = primitive.getAttribute("NORMAL"), index = primitive.getIndices();
  const source = i => { const p = position.getElement(i, []); return [p[0] * 35 + 1, -p[2] * 35 - 2, p[1] * 35 + 11.626905]; };
  const key = i => source(i).map(value => value.toFixed(4)).join(",");
  const edges = new Map(); let volume = 0;
  for (let i = 0; i < index.getCount(); i += 3) {
    const ids = [0, 1, 2].map(j => index.getScalar(i + j)), p = ids.map(source);
    const a = p[1].map((v, j) => v - p[0][j]), b = p[2].map((v, j) => v - p[0][j]);
    const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const n = normal.getElement(ids[0], []), nativeNormal = [n[0], -n[2], n[1]];
    assert.ok(cross.reduce((sum, v, j) => sum + v * nativeNormal[j], 0) > 0);
    volume += p[0].reduce((sum, value, j) => sum + value * cross[j], 0) / 6;
    for (const point of p) {
      assert.ok(point[2] >= spec.bottomMM - 1e-5 && point[2] <= spec.topMM + 1e-5);
      assert.ok(((point[0] - spec.centreMM[0]) / spec.radiiMM[0]) ** 2 + ((point[1] - spec.centreMM[1]) / spec.radiiMM[1]) ** 2 <= 1.00001);
    }
    for (let j = 0; j < 3; j++) {
      const pair = [key(ids[j]), key(ids[(j + 1) % 3])], name = [...pair].sort().join("|");
      const list = edges.get(name) || []; list.push(pair); edges.set(name, list);
    }
  }
  assert.ok(volume > 0);
  for (const pairs of edges.values()) { assert.equal(pairs.length, 2); assert.deepEqual(pairs[0], [...pairs[1]].reverse()); }
  const material = primitive.getMaterial();
  assert.equal(material.getMetallicFactor(), 0); assert.equal(material.getRoughnessFactor(), .86);
  assert.deepEqual(material.getEmissiveFactor(), [0, 0, 0]); assert.equal(material.getBaseColorTexture(), null);
  assert.equal(doc.getRoot().listNodes()[0].getName(), CANDLE_WAX_CAP + spec.key);
});

test("adding a wax cap preserves existing geometry, UVs, material and texture bytes", () => {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene();
  const position = doc.createAccessor().setType("VEC3").setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])).setBuffer(buffer);
  const uv = doc.createAccessor().setType("VEC2").setArray(new Float32Array([0, 0, 1, 0, 0, 1])).setBuffer(buffer);
  const texture = doc.createTexture().setImage(new Uint8Array([1, 2, 3]));
  const material = doc.createMaterial().setBaseColorTexture(texture);
  const primitive = doc.createPrimitive().setAttribute("POSITION", position).setAttribute("TEXCOORD_0", uv).setMaterial(material);
  const node = doc.createNode("Body").setMesh(doc.createMesh().addPrimitive(primitive)); scene.addChild(node);
  const before = [Array.from(position.getArray()), Array.from(uv.getArray()), Array.from(texture.getImage())];
  addCandleWaxCaps(doc, [spec]);
  assert.deepEqual([Array.from(position.getArray()), Array.from(uv.getArray()), Array.from(texture.getImage())], before);
  assert.equal(primitive.getMaterial(), material); assert.equal(node.getMesh().listPrimitives()[0], primitive);
});

test("wax caps reject duplicates, excessive thickness and an unmeasured or raised surface", () => {
  for (const changed of [{ topMM: 61.49 }, { bottomMM: 60 }, { measuredRimSamples: 0 }, { radiiMM: [3, 1] }]) {
    const doc = new Document(); doc.createScene(); assert.throws(() => addCandleWaxCaps(doc, [{ ...spec, ...changed }]));
  }
  const doc = new Document(); doc.createScene(); addCandleWaxCaps(doc, [spec]);
  assert.throws(() => addCandleWaxCaps(doc, [spec]));
  const other = new Document(); other.createScene();
  assert.throws(() => addCandleWaxCaps(other, [spec], { sourceSHA256: "b".repeat(64) }));
});
