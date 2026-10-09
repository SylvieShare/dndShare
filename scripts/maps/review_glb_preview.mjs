import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readGlb, replaceImages } from "./glb_textures.mjs";
const run = promisify(execFile);
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { dequantize } = require("@gltf-transform/functions");
const { MeshoptDecoder } = require("meshoptimizer");

export async function writeBlenderPreview(bytes, target) {
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const glb = readGlb(Buffer.from(bytes)),
    decoded = new Map();
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "dndshare-model-preview-"),
  );
  try {
    for (let i = 0; i < (glb.json.images ?? []).length; i++) {
      const image = glb.json.images[i];
      if (image.mimeType !== "image/ktx2") continue;
      const view = glb.json.bufferViews[image.bufferView];
      const payload = glb.bin.subarray(
        view.byteOffset ?? 0,
        (view.byteOffset ?? 0) + view.byteLength,
      );
      const input = path.join(temporary, i + ".ktx2"),
        output = path.join(temporary, i + ".png");
      await fs.writeFile(input, payload);
      await run(
        path.join(
          process.env.KTX_TOOLS || "/private/tmp/dndshare-ktx-tools/bin",
          "ktx",
        ),
        ["extract", "--transcode", "rgba8", "--level", "0", input, output],
      );
      decoded.set(i, await fs.readFile(output));
      image.mimeType = "image/png";
    }
    if (decoded.size) {
      for (const t of glb.json.textures ?? []) {
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
    for (const extension of doc.getRoot().listExtensionsUsed())
      if (extension.extensionName === "EXT_meshopt_compression")
        extension.dispose();
    await io.write(target, doc);
  } finally {
    await fs.rm(temporary, { recursive: true });
  }
}
