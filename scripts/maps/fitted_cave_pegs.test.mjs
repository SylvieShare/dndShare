import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fitCavePegs, fittedPads } from "./fitted_cave_pegs.mjs";
import { pegPrimitive } from "./peg-geometry.mjs";
import { readGlb } from "./glb_textures.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { Document, NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { meshopt } = require("@gltf-transform/functions");
const { MeshoptEncoder, MeshoptDecoder } = require("meshoptimizer");
const pad = {
  top: { min: [-0.5, -0.5], max: [0.5, 0.5] },
  bottom: { min: [-0.372, -0.372], max: [0.372, 0.372] },
};
test("a simple fitted pyramid clears the independently measured LC-060 socket bevel", () => {
  const p = fittedPads([pad])[0],
    depth = 5.2556,
    topZ = 29.07289;
  for (const [z, clearanceRadius] of [
    [23.83, 13.48959],
    [25, 13.49013],
    [25.5, 13.75872],
    [26, 14.25976],
    [27, 15.26222],
    [28, 16.21793],
    [29.05, 17.21958],
  ]) {
    const t = (z - topZ + depth) / depth;
    const radius =
      (p.bottom.max[0] + (p.top.max[0] - p.bottom.max[0]) * t) * 35;
    assert(clearanceRadius - radius > 0.05, `socket clearance at ${z}mm`);
  }
  assert.throws(() =>
    fittedPads([{ ...pad, top: { min: [-1, -0.5], max: [1, 0.5] } }]),
  );
});

test("raw peg replacement preserves compressed body buffers, attributes and material", async () => {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const doc = new Document(),
    buffer = doc.createBuffer();
  const attr = (type, values) =>
    doc
      .createAccessor()
      .setType(type)
      .setArray(new Float32Array(values))
      .setBuffer(buffer);
  const body = doc
    .createPrimitive()
    .setAttribute(
      "POSITION",
      attr("VEC3", [-0.5, 0.2, -0.5, 0.5, 0.2, -0.5, 0, 0.4, 0.5]),
    )
    .setAttribute("NORMAL", attr("VEC3", [0, 1, 0, 0, 1, 0, 0, 1, 0]))
    .setMaterial(
      doc
        .createMaterial("Original body")
        .setBaseColorFactor([0.4, 0.3, 0.2, 1]),
    );
  const scene = doc.createScene();
  scene.addChild(
    doc
      .createNode("Original body")
      .setMesh(doc.createMesh("Original body").addPrimitive(body)),
  );
  scene.addChild(
    doc
      .createNode("Original peg")
      .setMesh(
        doc
          .createMesh("Original peg")
          .addPrimitive(pegPrimitive(doc, [pad], 0.15, "lost-cave")),
      ),
  );
  await doc.transform(
    meshopt({ encoder: MeshoptEncoder, level: "high", quantizePosition: 16 }),
  );
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "meshopt.encoder": MeshoptEncoder,
      "meshopt.decoder": MeshoptDecoder,
    });
  const original = Buffer.from(await io.writeBinary(doc));
  const fitted = await fitCavePegs(original, {
    collection: "lost-cave",
    mountDepth: 0.15,
  });
  const a = readGlb(original),
    b = readGlb(fitted.bytes);
  assert.deepEqual(
    b.bin.subarray(0, a.json.buffers[0].byteLength),
    a.bin.subarray(0, a.json.buffers[0].byteLength),
  );
  const signature = (d) =>
    d
      .getRoot()
      .listNodes()
      .filter((n) => n.getMesh()?.getName() === "Original body")
      .map((n) => ({
        matrix: n.getWorldMatrix(),
        primitives: n
          .getMesh()
          .listPrimitives()
          .map((p) => ({
            attributes: p
              .listSemantics()
              .map((s) => [s, Array.from(p.getAttribute(s).getArray())]),
            indices: p.getIndices()
              ? Array.from(p.getIndices().getArray())
              : null,
            colour: p.getMaterial().getBaseColorFactor(),
          })),
      }));
  assert.deepEqual(
    signature(await io.readBinary(fitted.bytes)),
    signature(await io.readBinary(original)),
  );
  assert.equal(fitted.pads.length, 1);
  const mounted = (await io.readBinary(fitted.bytes))
    .getRoot()
    .listMeshes()
    .find((mesh) => mesh.getName() === "Fitted insertion geometry")
    .listPrimitives()[0];
  assert.ok(mounted.getIndices(), "editor requires an indexed mounting mesh");
  assert.equal(mounted.getIndices().getCount() / 3, 12);
  const repeated = await fitCavePegs(fitted.bytes, {
    collection: "lost-cave",
    mountDepth: 0.15,
  });
  assert.equal(repeated.unchanged, true);
  assert.deepEqual(repeated.bytes, fitted.bytes);
});
