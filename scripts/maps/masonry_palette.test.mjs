import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OLD_STONE,
  STONE,
  masonryWeight,
  recolorMasonry,
} from "./masonry_palette.mjs";
import { readGlb, embeddedImage, replaceImages } from "./glb_textures.mjs";
import { columnBoneAt, repairColumnBones } from "./column_materials.mjs";
const rgb = (values) => values.map((v) => Math.round(v * 255));

test("skull-column shells become stone while bones remain inside the cavities", () => {
  for (const code of ["UD-087", "UD-088"]) {
    assert.equal(columnBoneAt(code, 13, 0, 35), false);
    assert.equal(columnBoneAt(code, 0, 0, 55), true);
  }
  assert.equal(columnBoneAt("UD-089", 12, 0, 27), false);
  assert.equal(columnBoneAt("UD-089", 0, 0, 27), true);
  const bone = Buffer.from(rgb([0.79, 0.72, 0.52]));
  const data = Buffer.concat([bone, bone]);
  assert.equal(repairColumnBones(data, 3, new Uint8Array([1, 2])), 1);
  assert.ok(data[0] < data[1] && data[1] <= data[2]);
  assert.deepEqual(data.subarray(3), bone);
});

test("masonry becomes cool grey across the existing light and dark grain", () => {
  for (const variation of [0.5, 0.75, 1, 1.1]) {
    const before = rgb(OLD_STONE.map((v) => v * variation));
    assert.ok(masonryWeight(before) > 0.99);
    const after = recolorMasonry(Buffer.from([...before, 255]), 4).data;
    assert.ok(after[0] < after[1] && after[1] <= after[2]);
    assert.equal(after[3], 255);
    if (variation === 1)
      STONE.forEach((v, i) => assert.ok(Math.abs(after[i] / 255 - v) < 0.006));
  }
});

test("wood, iron, bones, cloth, sacks, pottery and gold retain their pixels", () => {
  for (const color of [
    [0.39, 0.22, 0.105],
    [0.34, 0.35, 0.33],
    [0.79, 0.72, 0.52],
    [0.39, 0.17, 0.14],
    [0.57, 0.49, 0.29],
    [0.69, 0.61, 0.45],
    [0.72, 0.49, 0.16],
  ]) {
    for (const variation of [0.6, 1, 1.1]) {
      const pixel = Buffer.from(rgb(color.map((v) => v * variation)));
      assert.equal(masonryWeight([...pixel]), 0);
      assert.deepEqual(recolorMasonry(pixel, 3).data, pixel);
    }
  }
  assert.deepEqual(
    recolorMasonry(Buffer.from([0, 0, 0]), 3).data,
    Buffer.from([0, 0, 0]),
  );
});

test("GLB image resizing retains compressed geometry and normal-map bytes", () => {
  const json = {
    asset: { version: "2.0" },
    buffers: [{ byteLength: 24 }, { byteLength: 12 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 3 },
      { buffer: 0, byteOffset: 4, byteLength: 5 },
      {
        buffer: 1,
        byteOffset: 0,
        byteLength: 12,
        extensions: {
          EXT_meshopt_compression: { buffer: 0, byteOffset: 12, byteLength: 8 },
        },
      },
      { buffer: 0, byteOffset: 20, byteLength: 4 },
    ],
    images: [
      { mimeType: "image/png", bufferView: 0 },
      { mimeType: "image/png", bufferView: 1 },
    ],
    accessors: [{ bufferView: 2, count: 1, componentType: 5126, type: "VEC3" }],
  };
  const bin = Buffer.from(Array.from({ length: 24 }, (_, i) => i));
  const accessors = structuredClone(json.accessors);
  const result = readGlb(
    replaceImages({ json, bin }, new Map([[0, Buffer.alloc(9, 99)]])),
  );
  assert.equal(result.json.bufferViews[1].byteOffset, 12);
  assert.equal(
    result.json.bufferViews[2].extensions.EXT_meshopt_compression.byteOffset,
    20,
  );
  assert.equal(result.json.bufferViews[3].byteOffset, 28);
  assert.deepEqual(embeddedImage(result, 1), bin.subarray(4, 9));
  assert.deepEqual(result.bin.subarray(20, 28), bin.subarray(12, 20));
  assert.deepEqual(result.bin.subarray(28, 32), bin.subarray(20, 24));
  assert.deepEqual(result.json.accessors, accessors);
  assert.equal(result.json.buffers[0].byteLength, 32);
});
