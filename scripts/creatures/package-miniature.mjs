// Build an ignored, content-addressed upload folder; publication uses the MCP CLI.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(
  path.join(root, "models/.map-model-tools-runtime/package.json"),
);
const sharp = require("sharp");
const folder = path.resolve(process.argv[2]);
const recipe = JSON.parse(
  await fs.readFile(
    process.argv[3] || path.join(import.meta.dirname, "kobold-1635.json"),
    "utf8",
  ),
);
const output = path.join(folder, "publish");
await fs.mkdir(output, { recursive: true });
const assets = {};
for (const [kind, file] of [
  ["render", "kobold-1635.glb"],
  ["lod", "kobold-1635-lod.glb"],
  ["shadow", "kobold-1635-shadow.glb"],
  ["source", "kobold-1635-master.glb"],
  ["preview", "preview.png"],
]) {
  const data =
    kind === "preview"
      ? await sharp(path.join(folder, file))
          .resize(512, 512, { fit: "inside" })
          .webp({ quality: 90 })
          .toBuffer()
      : await fs.readFile(path.join(folder, file));
  const sha256 = crypto.createHash("sha256").update(data).digest("hex");
  const ext = kind === "preview" ? "webp" : "glb";
  const name = `${sha256}.${ext}`;
  await fs.writeFile(path.join(output, name), data);
  assets[kind] = {
    key: `map-models/${name}`,
    sha256,
    size: data.length,
    mimeType: kind === "preview" ? "image/webp" : "model/gltf-binary",
    fileName: kind === "preview" ? "kobold-1635.webp" : file,
  };
}
const { itemId, modelId, ...metadata } = recipe;
const model = {
  ...metadata,
  id: modelId,
  variantCode: "",
  category: "object",
  tileType: "object",
  textureDetail: "detailed",
  hasDecor: true,
  canStand: false,
  hidden: true,
  placementPoints: [],
  wallMode: "none",
  wallMask: 0,
  width: 1,
  height: 1,
  placementOffset: [0, 0],
  mountDepth: 0,
  surfaceHeight: 0,
  blockers: [],
  tags: ["creature", "bestiary"],
  supportSlots: [],
  assets,
};
await fs.writeFile(
  path.join(output, "catalogue.json"),
  JSON.stringify([model], null, 2) + "\n",
);
console.log(
  JSON.stringify({
    output,
    itemId,
    modelId,
    bytes: Object.fromEntries(
      Object.entries(assets).map(([k, a]) => [k, a.size]),
    ),
  }),
);
