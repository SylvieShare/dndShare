import fs from "node:fs/promises";
import path from "node:path";
const base = path.resolve(import.meta.dirname, "../../models/collections");
let index;
async function walk(directory, result) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file, result);
    else if (/^[0-9a-f]{64}\.(glb|stl|webp)$/.test(entry.name))
      result.set(entry.name, file);
  }
}
export async function localModelAsset(asset) {
  if (!index) {
    index = new Map();
    await walk(base, index);
  }
  const file = index.get(path.basename(asset.key));
  if (!file) throw new Error("Missing local immutable asset: " + asset.sha256);
  return file;
}
