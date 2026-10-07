import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { transparentPreview } from "./preview_image.mjs";
const base = path.resolve(
  process.argv[2] || "models/collections/transparent-catalogue",
);
const inventory = JSON.parse(
  await fs.readFile(path.join(base, "inventory.json"), "utf8"),
);
await fs.mkdir(path.join(base, "assets"), { recursive: true });
const manifest = [],
  failures = [];
for (const e of inventory) {
  if (e.transparent) continue;
  const model = e.model,
    dir = path.join(base, "prepared", model.id);
  try {
    const image = await transparentPreview(
      path.join(dir, "transparent-preview.png"),
    );
    const hash = createHash("sha256").update(image.bytes).digest("hex");
    await fs.writeFile(path.join(base, "assets", hash + ".webp"), image.bytes);
    const { bytes, ...report } = image;
    manifest.push({
      model,
      expectedRenderSHA256: model.assets.render.sha256,
      asset: {
        key: `map-models/${hash}.webp`,
        sha256: hash,
        size: bytes.length,
        mimeType: "image/webp",
        fileName: "preview.webp",
      },
      report,
    });
  } catch (error) {
    failures.push({
      code: model.sourceCode,
      id: model.id,
      error: error.message,
    });
  }
}
await fs.writeFile(
  path.join(base, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await fs.writeFile(
  path.join(base, "failures.json"),
  JSON.stringify(failures, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    packaged: manifest.length,
    bytes: manifest.reduce((s, e) => s + e.asset.size, 0),
    failures,
  }),
);
if (failures.length) process.exitCode = 1;
