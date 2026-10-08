// Called only after MCP confirms registration; models/ remains ignored by Git.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { requestedCollection } from "./review_collection.mjs";
const directory = process.argv[2];
const review = requestedCollection();
if (!directory) throw new Error("Registered asset directory required");
const published = JSON.parse(
  await fs.readFile(path.join(directory, "catalogue.json"), "utf8"),
);
if (
  published.some(
    (m) => m.collection !== review.collection || m.textureDetail !== "detailed",
  )
)
  throw new Error("Only matching reviewed models can be recorded");
const file = review.snapshot,
  registry = JSON.parse(await fs.readFile(file, "utf8"));
for (const model of published)
  assert.deepEqual(
    registry.find((m) => m.id === model.id),
    model,
    "Confirm publication from a fresh MCP snapshot first",
  );
await fs.writeFile(file + ".next", JSON.stringify(registry, null, 2) + "\n", {
  mode: 0o600,
});
await fs.rename(file + ".next", file);
const latest = new Map();
for (const model of registry.filter(
  (m) => m.collection === review.collection,
)) {
  const key = model.sourceCode + ":" + model.sourceName;
  if (!latest.has(key)) latest.set(key, model);
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
  }));
await fs.writeFile(
  path.join(review.detail, "progress.json"),
  JSON.stringify(progress, null, 2) + "\n",
);
console.log(
  "REVIEW_PROGRESS",
  progress.filter((m) => m.status === "published").length,
  "/",
  progress.length,
);
