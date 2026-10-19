import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  stripSculptedFlames,
  triangleFingerprint,
  materialImages,
  stripMeasuredFlames,
} from "./model_flame_geometry.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { Document } = require("@gltf-transform/core");
test("removes the measured flame, preserves body attributes and ignores cyclic index rotations", () => {
  const doc = new Document(),
    b = doc.createBuffer(),
    material = doc.createMaterial().setEmissiveFactor([1, 0.5, 0.1]),
    mesh = doc.createMesh(),
    scene = doc.createScene();
  const p = doc
    .createPrimitive()
    .setIndices(
      doc
        .createAccessor()
        .setType("SCALAR")
        .setArray(new Uint16Array([0, 1, 2, 3, 4, 5]))
        .setBuffer(b),
    )
    .setAttribute(
      "POSITION",
      doc
        .createAccessor()
        .setType("VEC3")
        .setArray(
          new Float32Array([
            0, 0, 0, 0.1, 0, 0, 0, 0, 0.1, 0, 1, 0, 0.01, 1, 0, 0, 1, 0.01,
          ]),
        )
        .setBuffer(b),
    )
    .setAttribute(
      "NORMAL",
      doc
        .createAccessor()
        .setType("VEC3")
        .setArray(
          new Float32Array([
            0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
          ]),
        )
        .setBuffer(b),
    )
    .setMaterial(material);
  mesh.addPrimitive(p);
  scene.addChild(doc.createNode("body").setMesh(mesh));
  const images = materialImages(doc),
    result = stripSculptedFlames(doc, {
      surfaceParts: [{ kind: "flame", minMM: [-1, -1, 34], maxMM: [1, 1, 36] }],
    });
  assert.equal(result.counts[0].removed, 1);
  assert.equal(p.getAttribute("POSITION").getCount(), 3);
  assert.deepEqual(
    [...p.getAttribute("POSITION").getArray()],
    [0, 0, 0, Math.fround(0.1), 0, 0, 0, 0, Math.fround(0.1)],
  );
  const hash = triangleFingerprint(doc);
  p.getIndices().setArray(new Uint16Array([1, 2, 0]));
  assert.equal(triangleFingerprint(doc), hash);
  assert.deepEqual(materialImages(doc), images);
  assert.deepEqual(material.getEmissiveFactor(), [0, 0, 0]);
});

test("source-centre offsets select only the measured flame and retain the original body", () => {
  const doc = new Document(),
    buffer = doc.createBuffer(),
    material = doc.createMaterial();
  const primitive = doc
    .createPrimitive()
    .setMaterial(material)
    .setAttribute(
      "POSITION",
      doc
        .createAccessor()
        .setType("VEC3")
        .setBuffer(buffer)
        .setArray(
          new Float32Array([
            0, 0, 0, 0.1, 0, 0, 0, 0, 0.1, 0, 1, 0, 0.01, 1, 0, 0, 1, 0.01,
          ]),
        ),
    )
    .setIndices(
      doc
        .createAccessor()
        .setType("SCALAR")
        .setBuffer(buffer)
        .setArray(new Uint16Array([0, 1, 2, 3, 4, 5])),
    );
  doc
    .createScene()
    .addChild(
      doc.createNode().setMesh(doc.createMesh().addPrimitive(primitive)),
    );
  const result = stripMeasuredFlames(
    doc,
    (p) => p[0] >= 70 && p[1] <= -35 && p[2] > 50,
    [70, -35, 17],
  );
  assert.equal(result.counts[0].removed, 1);
  assert.equal(primitive.getAttribute("POSITION").getCount(), 3);
  assert.deepEqual(
    [...primitive.getAttribute("POSITION").getArray()],
    [0, 0, 0, Math.fround(0.1), 0, 0, 0, 0, Math.fround(0.1)],
  );
});
