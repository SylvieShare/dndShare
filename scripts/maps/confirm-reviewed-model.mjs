import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { requestedCollection } from "./review_collection.mjs";
const code = process.argv[2],
  snapshot = process.argv[3];
if (!code || path.basename(code) !== code || !snapshot)
  throw new Error("One reviewed code and fresh MCP snapshot required");
const review = requestedCollection(),
  directory = path.join(review.detail, code, "upload");
const packet = JSON.parse(
  await fs.readFile(path.join(directory, "catalogue.json"), "utf8"),
);
if (
  packet.length !== 1 ||
  packet[0].collection !== review.collection ||
  packet[0].sourceCode !== code
)
  throw new Error("One matching reviewed variant required");
const local = packet[0],
  remote = JSON.parse(await fs.readFile(snapshot, "utf8"));
assert.deepEqual(
  remote.find((m) => m.id === local.id),
  local,
  "Registered metadata differs from reviewed packet",
);
const latest = remote
  .filter(
    (m) =>
      m.collection === local.collection &&
      m.sourceCode === code &&
      m.sourceName === local.sourceName,
  )
  .sort((a, b) => b.version - a.version)[0];
assert.equal(latest.id, local.id, "Reviewed version is not current");
assert.equal(latest.textureDetail, "detailed");
assert.deepEqual(Object.keys(latest.assets).sort(), [
  "lod",
  "preview",
  "render",
  "shadow",
  "source",
]);
const file = review.snapshot;
await fs.writeFile(
  file + ".next",
  JSON.stringify(
    remote.filter((m) => m.collection === review.collection),
    null,
    2,
  ) + "\n",
  { mode: 0o600 },
);
await fs.rename(file + ".next", file);
console.log("VERIFIED", code, latest.version, latest.id, "five resources");
