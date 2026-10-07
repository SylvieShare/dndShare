import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import specs from "./open-doors.json" with { type: "json" };
import { localModelAsset } from "./local_model_assets.mjs";
import { doorIO } from "./open-door-assets.mjs";
const code = process.argv[2],
  snapshot = process.argv[3];
if (!specs[code] || !snapshot)
  throw new Error("Reviewed base door and fresh MCP snapshot required");
const rows = JSON.parse(await fs.readFile(snapshot, "utf8"));
const model = rows
  .filter((m) => m.collection === "ultimate-dungeon" && m.sourceCode === code)
  .sort((a, b) => b.version - a.version)[0];
if (!model || model.textureDetail !== "detailed")
  throw new Error("Detailed closed door required");
if (
  rows.some(
    (m) =>
      m.collection === model.collection && m.sourceCode === specs[code].code,
  )
)
  throw new Error(
    "Open variant exists; do not overwrite its first-version packet",
  );
const dir = path.resolve(
  import.meta.dirname,
  "../../models/collections/open-doors/reference",
  code,
);
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { dequantize } = require("@gltf-transform/functions");
await fs.mkdir(dir, { recursive: true });
await fs.writeFile(
  path.join(dir, "report.json"),
  JSON.stringify({ model }, null, 2) + "\n",
);
for (const tier of ["render", "lod"]) {
  const document = await doorIO.read(await localModelAsset(model.assets[tier]));
  await document.transform(dequantize());
  for (const extension of document.getRoot().listExtensionsUsed())
    if (
      ["EXT_meshopt_compression", "KHR_mesh_quantization"].includes(
        extension.extensionName,
      )
    )
      extension.dispose();
  await doorIO.write(
    path.join(
      dir,
      tier === "render" ? "preview-model.glb" : "lod-preview-model.glb",
    ),
    document,
  );
}
console.log("OPEN_DOOR_REFERENCE", code, model.id, model.version);
