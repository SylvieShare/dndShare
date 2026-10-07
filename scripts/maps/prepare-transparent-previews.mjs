// Reconstruct Blender-readable copies of the published render; never alter S3 resources.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readGlb, replaceImages } from "./glb_textures.mjs";
const run = promisify(execFile),
  require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { dequantize } = require("@gltf-transform/functions"),
  { MeshoptDecoder } = require("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const folder = path.resolve(
    process.argv[2] || "models/collections/transparent-catalogue",
  ),
  inventory = JSON.parse(
    await fs.readFile(path.join(folder, "inventory.json"), "utf8"),
  );
const ktx = process.env.KTX_TOOLS || "/private/tmp/dndshare-ktx-tools/bin";
const selected = process.argv
  .find((a) => a.startsWith("--codes="))
  ?.slice(8)
  .split(",");
let completed = 0;
for (const entry of inventory) {
  const m = entry.model;
  if (entry.transparent || (selected && !selected.includes(m.sourceCode)))
    continue;
  const dir = path.join(folder, "prepared", m.id);
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, "preview-model.glb");
  if (await fs.stat(target).catch(() => null)) {
    completed++;
    continue;
  }
  const bytes = await fs.readFile(entry.render);
  if (
    createHash("sha256").update(bytes).digest("hex") !== m.assets.render.sha256
  )
    throw Error("Render checksum mismatch: " + m.sourceCode);
  const glb = readGlb(bytes),
    decoded = new Map();
  for (let i = 0; i < (glb.json.images || []).length; i++) {
    const image = glb.json.images[i];
    if (image.mimeType !== "image/ktx2") continue;
    const view = glb.json.bufferViews[image.bufferView],
      payload = glb.bin.subarray(
        view.byteOffset || 0,
        (view.byteOffset || 0) + view.byteLength,
      );
    const input = path.join(dir, `texture-${i}.ktx2`),
      output = path.join(dir, `texture-${i}.png`);
    await fs.writeFile(input, payload);
    await run(path.join(ktx, "ktx"), [
      "extract",
      "--transcode",
      "rgba8",
      "--level",
      "0",
      input,
      output,
    ]);
    decoded.set(i, await fs.readFile(output));
    image.mimeType = "image/png";
    await fs.rm(input);
    await fs.rm(output);
  }
  if (decoded.size) {
    for (const t of glb.json.textures || []) {
      if (!t.extensions?.KHR_texture_basisu) continue;
      t.source = t.extensions.KHR_texture_basisu.source;
      delete t.extensions.KHR_texture_basisu;
      if (!Object.keys(t.extensions).length) delete t.extensions;
    }
    for (const field of ["extensionsUsed", "extensionsRequired"])
      if (glb.json[field])
        glb.json[field] = glb.json[field].filter(
          (v) => v !== "KHR_texture_basisu",
        );
  }
  const doc = await io.readBinary(
    decoded.size ? replaceImages(glb, decoded) : bytes,
  );
  await doc.transform(dequantize());
  for (const ext of doc.getRoot().listExtensionsUsed())
    if (ext.extensionName === "EXT_meshopt_compression") ext.dispose();
  await io.write(target, doc);
  await fs.writeFile(
    path.join(dir, "report.json"),
    JSON.stringify(
      {
        model: m,
        referenceRenderSHA256: m.assets.render.sha256,
        referencePreview: entry.preview,
        width: entry.width,
        height: entry.height,
      },
      null,
      2,
    ) + "\n",
  );
  completed++;
  console.log(
    JSON.stringify({
      prepared: completed,
      code: m.sourceCode,
      collection: m.collection,
      decodedTextures: decoded.size,
    }),
  );
}
