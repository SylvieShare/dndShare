// Record progress only after a fresh MCP snapshot confirms every published asset.
import fs from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
const base = path.resolve(
  import.meta.dirname,
  "../../models/collections/majestic-highlands",
);
const directory = process.argv[2];
if (!directory) throw new Error("Published asset directory required");
const models = JSON.parse(
  await fs.readFile(path.join(directory, "catalogue.json"), "utf8"),
);
const registry = JSON.parse(
  await fs.readFile(path.join(base, "registry-snapshot.json"), "utf8"),
);
const progress = JSON.parse(
  await fs.readFile(path.join(base, "progress.json"), "utf8"),
);
for (const model of models) {
  if (model.collection !== "majestic-highlands")
    throw new Error("Wrong collection");
  const live = registry.find((m) => m.id === model.id);
  if (!live || !isDeepStrictEqual(live, model))
    throw new Error("MCP has not confirmed this exact model");
  const reportFile = path.join(
    base,
    "optimized-review",
    model.sourceCode,
    "report.json",
  );
  const report = JSON.parse(await fs.readFile(reportFile, "utf8"));
  report.published = {
    id: live.id,
    version: live.version,
    verifiedAt: new Date().toISOString(),
  };
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + "\n");
  const entry = progress.find((r) => r.code === model.sourceCode);
  if (!entry) throw new Error("Unknown queue entry");
  Object.assign(entry, {
    status: "published",
    id: live.id,
    version: live.version,
    width: live.width,
    height: live.height,
    renderBytes: live.assets.render.size,
    lodBytes: live.assets.lod.size,
    shadowBytes: live.assets.shadow.size,
    recipe: report.materialRecipe ?? report.recipe,
  });
}
await fs.writeFile(
  path.join(base, "progress.json.next"),
  JSON.stringify(progress, null, 2) + "\n",
);
await fs.rename(
  path.join(base, "progress.json.next"),
  path.join(base, "progress.json"),
);
console.log(
  "MAJESTIC_PROGRESS",
  progress.filter((m) => m.status === "published").length,
  "/",
  progress.length,
);
