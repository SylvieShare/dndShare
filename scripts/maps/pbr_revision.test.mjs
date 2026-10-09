import test from "node:test";
import assert from "node:assert/strict";
import {
  setSurfaceAtlas,
  initializeUntexturedSurfaceAtlas,
} from "./pbr_revision.mjs";
import { readGlb, replaceImages, embeddedImage } from "./glb_textures.mjs";
test("adding a missing packed PBR atlas retains the original mesh bytes and UV slot", () => {
  const geometry = Buffer.from([1, 2, 3, 4]),
    old = Buffer.from([7, 8, 9, 10]);
  const glb = {
    bin: Buffer.concat([geometry, old]),
    json: {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 8 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 4 },
        { buffer: 0, byteOffset: 4, byteLength: 4 },
      ],
      images: [{ bufferView: 1, mimeType: "image/png" }],
      textures: [{ source: 0, sampler: 0 }],
      materials: [
        {
          pbrMetallicRoughness: { baseColorTexture: { index: 0, texCoord: 1 } },
        },
      ],
    },
  };
  const payload = Buffer.alloc(11, 45),
    index = setSurfaceAtlas(glb, "MetallicRoughness", payload);
  const output = readGlb(replaceImages(glb, new Map([[index, payload]])));
  assert.deepEqual(output.bin.subarray(0, 4), geometry);
  assert.deepEqual(embeddedImage(output, index), payload);
  assert.deepEqual(output.json.materials[0].occlusionTexture, {
    index: 1,
    texCoord: 1,
  });
  assert.equal(output.json.materials[0].pbrMetallicRoughness.metallicFactor, 1);
  const emissionIndex = setSurfaceAtlas(glb, "Emissive", payload),
    emitted = readGlb(replaceImages(glb, new Map([[emissionIndex, payload]])));
  assert.deepEqual(emitted.bin.subarray(0, 4), geometry);
  assert.deepEqual(emitted.json.materials[0].emissiveTexture, {
    index: 2,
    texCoord: 1,
  });
  assert.deepEqual(emitted.json.materials[0].emissiveFactor, [1, 1, 1]);
  assert.notEqual(emissionIndex, index);
});

test("source-rebuilt vertex-colour body receives three independent PBR atlases without tinting the pegs", () => {
  const pegs = {
    name: "Simple insertion pegs",
    pbrMetallicRoughness: { baseColorFactor: [0.2, 0.1, 0.05, 1] },
  };
  const glb = {
    json: {
      buffers: [{ byteLength: 0 }],
      bufferViews: [],
      materials: [
        pegs,
        {
          name: "LC-057 stone",
          pbrMetallicRoughness: { baseColorFactor: [0.4, 0.3, 0.2, 1] },
        },
      ],
    },
    bin: Buffer.alloc(0),
  };
  initializeUntexturedSurfaceAtlas(glb, Buffer.from([1, 2, 3, 4]));
  const slots = ["BaseColor", "Normal", "MetallicRoughness"].map((slot) =>
    setSurfaceAtlas(glb, slot, Buffer.from([5, 6, 7, 8])),
  );
  assert.equal(new Set(slots).size, 3);
  assert.deepEqual(
    glb.json.materials[1].pbrMetallicRoughness.baseColorFactor,
    [1, 1, 1, 1],
  );
  assert.deepEqual(
    pegs.pbrMetallicRoughness.baseColorFactor,
    [0.2, 0.1, 0.05, 1],
  );
  assert.equal(pegs.pbrMetallicRoughness.baseColorTexture, undefined);
  const mat = glb.json.materials[1];
  assert.equal(
    mat.occlusionTexture.index,
    mat.pbrMetallicRoughness.metallicRoughnessTexture.index,
  );
  assert.equal(mat.pbrMetallicRoughness.metallicFactor, 1);
});

test("initializing a formerly untextured body makes its baked UV surface sampleable", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(
    "/private/tmp/dndshare-model-tools/package.json",
  );
  const { Document, NodeIO } = require("@gltf-transform/core");
  const sharp = require("sharp");
  const { rasterizeSurface } = await import("./uv_surface.mjs");
  const doc = new Document(),
    buffer = doc.createBuffer();
  const accessor = (type, values, ArrayType = Float32Array) =>
    doc
      .createAccessor()
      .setType(type)
      .setArray(new ArrayType(values))
      .setBuffer(buffer);
  const primitive = doc
    .createPrimitive()
    .setAttribute("POSITION", accessor("VEC3", [0, 0, 0, 1, 0, 0, 0, 1, 0]))
    .setAttribute("NORMAL", accessor("VEC3", [0, 0, 1, 0, 0, 1, 0, 0, 1]))
    .setAttribute(
      "TEXCOORD_0",
      accessor("VEC2", [0.1, 0.1, 0.9, 0.1, 0.1, 0.9]),
    )
    .setIndices(accessor("SCALAR", [0, 1, 2], Uint16Array))
    .setMaterial(doc.createMaterial("LC-057 stone"));
  doc
    .createScene()
    .addChild(
      doc.createNode().setMesh(doc.createMesh().addPrimitive(primitive)),
    );
  const io = new NodeIO(),
    glb = readGlb(Buffer.from(await io.writeBinary(doc)));
  const png = await sharp({
    create: { width: 1, height: 1, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  assert.equal(initializeUntexturedSurfaceAtlas(glb, png), true);
  const initialized = await io.readBinary(replaceImages(glb, new Map()));
  let samples = 0;
  rasterizeSurface(initialized, 16, 16, () => samples++);
  assert(samples > 50);
  assert.equal(initializeUntexturedSurfaceAtlas(glb, png), false);
});
