import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const sharp = require("sharp");
const directory = path.resolve(process.argv[2]);
const file = path.join(directory, "publish/catalogue.json");
const models = JSON.parse(await fs.readFile(file));
for (const model of models) {
  const data = await sharp(path.join(directory, model.id, "preview.png")).webp({ quality: 90 }).toBuffer();
  const sha256 = crypto.createHash("sha256").update(data).digest("hex");
  await fs.writeFile(path.join(directory, "publish", `${sha256}.webp`), data);
  model.assets.preview = { key: `map-models/${sha256}.webp`, sha256, size: data.length,
    mimeType: "image/webp", fileName: `${model.sourceCode}.webp` };
}
await fs.writeFile(file, JSON.stringify(models, null, 2) + "\n");
