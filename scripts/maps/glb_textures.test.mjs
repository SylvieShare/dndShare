import test from "node:test";
import assert from "node:assert/strict";
import { readGlb, replaceImages } from "./glb_textures.mjs";

test("KTX replacement relocates real Meshopt bytes and preserves virtual fallback offsets", () => {
  const glb = {
    json: {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 12 }, { byteLength: 128 }],
      images: [{ mimeType: "image/ktx2", bufferView: 0 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 4 },
        { buffer: 1, byteOffset: 96, byteLength: 16,
          extensions: { EXT_meshopt_compression: { buffer: 0, byteOffset: 4, byteLength: 8 } } },
      ],
    },
    bin: Buffer.from([1, 2, 3, 4, 10, 11, 12, 13, 14, 15, 16, 17]),
  };
  const result = readGlb(replaceImages(glb, new Map([[0, Buffer.from([5, 6, 7, 8, 9])]])));
  assert.equal(result.json.bufferViews[0].byteLength, 5);
  assert.equal(result.json.bufferViews[1].byteOffset, 96);
  const compressed = result.json.bufferViews[1].extensions.EXT_meshopt_compression;
  assert.equal(compressed.byteOffset, 8);
  assert(result.bin.subarray(8, 16).equals(Buffer.from([10, 11, 12, 13, 14, 15, 16, 17])));
  assert(result.bin.subarray(0, 5).equals(Buffer.from([5, 6, 7, 8, 9])));
});
