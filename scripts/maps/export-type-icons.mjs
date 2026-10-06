// Encode the shared Blender renders as transparent, high-DPI UI assets.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { TILE_TYPES } from "../../frontend/src/features/maps/lib/tileCategories.js";

const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(
  process.env.DNDSHARE_MAP_TOOLS_PACKAGE ||
    "/private/tmp/dndshare-model-tools/package.json",
);
const sharp = require("sharp");
const source = path.join(root, "models/ui/tile-type-icons");
const output = path.join(root, "frontend/src/assets/maps/tile-types");
await fs.mkdir(output, { recursive: true });
let bytes = 0;
for (const { value } of TILE_TYPES) {
  const file = path.join(output, `${value}.webp`);
  await sharp(path.join(source, `${value}.png`))
    .resize(192, 192)
    .webp({ quality: 92, effort: 6 })
    .toFile(file);
  const metadata = await sharp(file).metadata();
  if (!metadata.hasAlpha || metadata.width !== 192 || metadata.height !== 192)
    throw new Error(`Invalid tile icon: ${value}`);
  bytes += (await fs.stat(file)).size;
}
console.log(`Exported ${TILE_TYPES.length} shared tile icons: ${bytes} bytes`);
