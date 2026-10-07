import { createRequire } from "node:module";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  sharp = require("sharp");
export async function textureDimensions(bytes, mimeType) {
  if (mimeType === "image/ktx2") {
    const magic = Buffer.from([
      0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    if (bytes.length < 80 || !bytes.subarray(0, 12).equals(magic))
      throw new Error("Invalid KTX2 header");
    return { width: bytes.readUInt32LE(20), height: bytes.readUInt32LE(24) };
  }
  return sharp(bytes).metadata();
}
