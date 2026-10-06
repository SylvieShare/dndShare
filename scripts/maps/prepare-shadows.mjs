// Prepare immutable, geometry-only shadow assets. Original files stay in models/.
import fs from "node:fs/promises";
import path from "node:path";
import { prepareShadow } from "./shadow_model.mjs";
const root = path.resolve(import.meta.dirname, "../..");
function option(name, fallback) {
  return (
    process.argv
      .find((a) => a.startsWith(`--${name}=`))
      ?.slice(name.length + 3) || fallback
  );
}
const input = option(
    "catalogue",
    path.join(root, "models/collections/registry.json"),
  ),
  output = option("output", path.join(root, "models/shadows")),
  codes = option("codes", "").split(",").filter(Boolean);
const models = JSON.parse(await fs.readFile(input, "utf8")),
  latest = new Map();
for (const m of models) {
  const key = `${m.collection}:${m.sourceCode}:${m.sourceName}:${m.assets.source.sha256}`;
  if (!latest.has(key) || latest.get(key).version < m.version)
    latest.set(key, m);
}
const files = new Map();
async function index(folder) {
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) await index(file);
    else if (/^[a-f0-9]{64}\.glb$/.test(entry.name))
      files.set(entry.name, file);
  }
}
await index(path.join(root, "models"));
await fs.mkdir(path.join(output, "assets"), { recursive: true });
const cache = new Map(),
  result = [];
const critical = new Set([
  "UD-021",
  "UD-022",
  "UD-024",
  "UD-025",
  "UD-042",
  "MA-DungeonChest",
]);
const selected = [...latest.values()]
  .filter((m) => !m.hidden && (!codes.length || codes.includes(m.sourceCode)))
  .sort(
    (a, b) =>
      Number(critical.has(b.sourceCode)) - Number(critical.has(a.sourceCode)) ||
      a.sourceCode.localeCompare(b.sourceCode),
  );
for (const model of selected) {
  const lod = model.assets.lod;
  if (!cache.has(lod.sha256)) {
    const file = files.get(`${lod.sha256}.glb`);
    if (!file)
      throw new Error(`Local LOD missing: ${model.sourceCode} ${lod.sha256}`);
    const temporary = path.join(output, "assets/next.glb"),
      prepared = await prepareShadow(file, temporary);
    await fs.rename(
      temporary,
      path.join(output, "assets", `${prepared.asset.sha256}.glb`),
    );
    cache.set(lod.sha256, prepared);
  }
  result.push({
    id: model.id,
    collection: model.collection,
    sourceCode: model.sourceCode,
    sourceName: model.sourceName,
    expectedLodSHA256: lod.sha256,
    ...cache.get(lod.sha256),
  });
  await fs.writeFile(
    path.join(output, "manifest.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      prepared: result.length,
      total: selected.length,
      code: model.sourceCode,
      bytes: result.at(-1).asset.size,
      triangles: result.at(-1).triangles,
    }),
  );
}
console.log(
  JSON.stringify({
    models: result.length,
    uniqueMeshes: cache.size,
    sourceBytes: result.reduce((n, m) => n + m.sourceBytes, 0),
    shadowBytes: result.reduce((n, m) => n + m.asset.size, 0),
  }),
);
