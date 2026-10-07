import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import specs from "./open-doors.json" with { type: "json" };
const code = process.argv[2];
if (!specs[code]) throw new Error("One reviewed door required");
const dir = path.resolve(
    import.meta.dirname,
    "../../models/collections/open-doors",
    specs[code].code,
  ),
  file = path.join(dir, "report.json"),
  report = JSON.parse(await fs.readFile(file, "utf8")),
  out = path.join(dir, "upload");
if (
  !report.optimization?.selection ||
  report.optimization.selection === "pending visual comparison" ||
  !report.preparedShadow
)
  throw new Error("Reviewed optimization and dedicated shadow required");
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  sharp = require("sharp");
await fs.mkdir(out, { recursive: true });
await sharp(path.join(dir, "preview.png"))
  .webp({ quality: 88 })
  .toFile(path.join(dir, "preview.webp"));
const assets = {
  source: report.model.assets.source,
  shadow: report.preparedShadow.asset,
};
for (const kind of ["render", "lod", "preview"]) {
  const ext = kind === "preview" ? "webp" : "glb",
    data = await fs.readFile(path.join(dir, kind + "." + ext)),
    sha256 = createHash("sha256").update(data).digest("hex");
  assets[kind] = {
    key: "map-models/" + sha256 + "." + ext,
    sha256,
    size: data.length,
    mimeType: kind === "preview" ? "image/webp" : "model/gltf-binary",
    fileName: kind + "." + ext,
  };
  await fs.writeFile(path.join(out, sha256 + "." + ext), data);
}
for (const kind of ["source", "shadow"])
  await fs.copyFile(
    path.join(dir, path.basename(assets[kind].key)),
    path.join(out, path.basename(assets[kind].key)),
  );
const identity = createHash("sha256")
  .update(
    report.recipe +
      ":" +
      report.model.sourceCode +
      ":" +
      JSON.stringify(assets),
  )
  .digest();
identity[6] = (identity[6] & 15) | 128;
identity[8] = (identity[8] & 63) | 128;
const hex = identity.subarray(0, 16).toString("hex");
report.model.id = [
  hex.slice(0, 8),
  hex.slice(8, 12),
  hex.slice(12, 16),
  hex.slice(16, 20),
  hex.slice(20),
].join("-");
report.model.assets = assets;
await fs.writeFile(file, JSON.stringify(report, null, 2) + "\n");
await fs.writeFile(
  path.join(out, "catalogue.json"),
  JSON.stringify([report.model], null, 2) + "\n",
);
console.log(
  "OPEN_DOOR_PACKET",
  report.model.sourceCode,
  report.model.id,
  report.model.version,
);
