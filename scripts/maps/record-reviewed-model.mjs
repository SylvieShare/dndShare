// Called only after MCP confirms registration; models/ remains ignored by Git.
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../.."),
  base = path.join(root, "models/collections");
const directory = process.argv[2];
if (!directory) throw new Error("Registered asset directory required");
const published = JSON.parse(
  await fs.readFile(path.join(directory, "catalogue.json"), "utf8"),
);
if (
  published.some(
    (m) =>
      m.collection !== "ultimate-dungeon" || m.textureDetail !== "detailed",
  )
)
  throw new Error("Only reviewed Ultimate Dungeon models can be recorded");
const file = path.join(base, "ultimate-dungeon/registry-snapshot.json"),
  registry = JSON.parse(await fs.readFile(file, "utf8"));
for (const model of published)
  if (!registry.some((m) => m.id === model.id)) registry.push(model);
await fs.writeFile(file + ".next", JSON.stringify(registry, null, 2) + "\n", {
  mode: 0o600,
});
await fs.rename(file + ".next", file);
const latest = new Map();
for (const model of registry.filter(
  (m) => m.collection === "ultimate-dungeon",
)) {
  const key = model.sourceCode + ":" + model.sourceName;
  if (!latest.has(key) || latest.get(key).version < model.version)
    latest.set(key, model);
}
const progress = [...latest.values()]
  .sort(
    (a, b) =>
      a.sourceCode.localeCompare(b.sourceCode) ||
      a.sourceName.localeCompare(b.sourceName),
  )
  .map((m) => ({
    code: m.sourceCode,
    name: m.sourceName,
    status: m.textureDetail === "detailed" ? "published" : "pending",
    id: m.id,
    version: m.version,
  }));
await fs.writeFile(
  path.join(base, "ultimate-detail/progress.json"),
  JSON.stringify(progress, null, 2) + "\n",
);
console.log(
  "REVIEW_PROGRESS",
  progress.filter((m) => m.status === "published").length,
  "/",
  progress.length,
);
