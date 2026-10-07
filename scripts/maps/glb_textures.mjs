// Replace embedded PNGs without decoding, simplifying or rewriting mesh bytes.
export function readGlb(bytes) {
  if (
    bytes.toString("ascii", 0, 4) !== "glTF" ||
    bytes.readUInt32LE(4) !== 2 ||
    bytes.readUInt32LE(8) !== bytes.length
  )
    throw new Error("Invalid GLB header");
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a)
    throw new Error("Missing JSON chunk");
  const json = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
  const binHeader = 20 + jsonLength;
  if (bytes.readUInt32LE(binHeader + 4) !== 0x004e4942)
    throw new Error("Missing binary chunk");
  const bin = bytes.subarray(
    binHeader + 8,
    binHeader + 8 + bytes.readUInt32LE(binHeader),
  );
  if (bin.length < json.buffers[0].byteLength)
    throw new Error("Truncated buffer");
  return { json, bin };
}

export function embeddedImage(glb, imageIndex) {
  const image = glb.json.images[imageIndex];
  const view = glb.json.bufferViews[image.bufferView];
  if (image.mimeType !== "image/png" || view.buffer !== 0)
    throw new Error("Expected an embedded PNG in the physical buffer");
  return glb.bin.subarray(
    view.byteOffset || 0,
    (view.byteOffset || 0) + view.byteLength,
  );
}

export function appendEmbeddedImage(glb, bytes, mimeType = "image/png") {
  const start = Math.ceil(glb.json.buffers[0].byteLength / 4) * 4;
  const binary = Buffer.alloc(start + Math.ceil(bytes.length / 4) * 4);
  glb.bin.copy(binary, 0, 0, glb.json.buffers[0].byteLength);
  bytes.copy(binary, start);
  const bufferView = glb.json.bufferViews.length;
  glb.json.bufferViews.push({
    buffer: 0,
    byteOffset: start,
    byteLength: bytes.length,
  });
  const index = glb.json.images.length;
  glb.json.images.push({ bufferView, mimeType });
  glb.json.buffers[0].byteLength = binary.length;
  glb.bin = binary;
  return index;
}

export function replaceImages(glb, images) {
  const { json, bin } = glb;
  const replacements = [...images]
    .map(([imageIndex, bytes]) => {
      const index = json.images[imageIndex].bufferView;
      const view = json.bufferViews[index];
      const padded = Buffer.alloc(Math.ceil(bytes.length / 4) * 4);
      bytes.copy(padded);
      const start = view.byteOffset || 0;
      if (start % 4) throw new Error("Unaligned image view");
      const length = Math.min(
        Math.ceil(view.byteLength / 4) * 4,
        json.buffers[0].byteLength - start,
      );
      return { index, start, length, bytes, padded };
    })
    .sort((a, b) => a.start - b.start);
  let cursor = 0;
  const chunks = [];
  for (const item of replacements) {
    if (item.start < cursor) throw new Error("Overlapping image views");
    chunks.push(bin.subarray(cursor, item.start), item.padded);
    cursor = item.start + item.length;
  }
  chunks.push(bin.subarray(cursor, json.buffers[0].byteLength));
  const binary = Buffer.concat(chunks);
  function relocate(offset) {
    let delta = 0;
    for (const item of replacements) {
      if (offset <= item.start) break;
      if (offset < item.start + item.length)
        throw new Error("View aliases an image");
      delta += item.padded.length - item.length;
    }
    return offset + delta;
  }
  for (let index = 0; index < json.bufferViews.length; index++) {
    const view = json.bufferViews[index];
    if (view.buffer === 0) view.byteOffset = relocate(view.byteOffset || 0);
    const compressed = view.extensions?.EXT_meshopt_compression;
    if (compressed?.buffer === 0)
      compressed.byteOffset = relocate(compressed.byteOffset || 0);
    const item = replacements.find((r) => r.index === index);
    if (item) view.byteLength = item.bytes.length;
  }
  json.buffers[0].byteLength = binary.length;
  const content = Buffer.from(JSON.stringify(json));
  const jsonBytes = Buffer.alloc(Math.ceil(content.length / 4) * 4, 0x20);
  content.copy(jsonBytes);
  const binaryBytes = Buffer.alloc(Math.ceil(binary.length / 4) * 4);
  binary.copy(binaryBytes);
  const header = Buffer.alloc(20),
    binHeader = Buffer.alloc(8);
  header.write("glTF");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + jsonBytes.length + 8 + binaryBytes.length, 8);
  header.writeUInt32LE(jsonBytes.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  binHeader.writeUInt32LE(binaryBytes.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonBytes, binHeader, binaryBytes]);
}
