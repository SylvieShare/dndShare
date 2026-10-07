import test from "node:test";
import assert from "node:assert/strict";
import { setSurfaceAtlas } from "./pbr_revision.mjs";
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
});
