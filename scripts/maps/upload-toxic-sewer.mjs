import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mapTool } from "./mcp_maps_client.mjs";
import { putReviewedAsset } from "./toxic_sewer_upload.mjs";

const directory = path.resolve(process.argv[2]);
const packet = JSON.parse(
  await fs.readFile(path.join(directory, "catalogue.json"), "utf8"),
);
assert.equal(packet.length, 1, "One reviewed model required");
const model = packet[0];
assert.equal(model.collection, "toxic-sewer");
assert.equal(model.textureDetail, "detailed");
const existing = JSON.parse(
  await fs.readFile(
    path.resolve("models/collections/toxic-sewer/registry-snapshot.json"),
    "utf8",
  ),
);
const identity = (a) =>
  JSON.stringify([a.key, a.sha256, a.size, a.mimeType, a.fileName]);
const known = new Set(
  existing.flatMap((m) => Object.values(m.assets).map(identity)),
);
for (const kind of ["preview", "render", "lod", "shadow", "source"]) {
  const asset = model.assets[kind];
  assert(asset, "All five resource roles required");
  if (known.has(identity(asset))) continue;
  const bytes = await fs.readFile(
    path.join(directory, path.basename(asset.key)),
  );
  assert.equal(bytes.length, asset.size);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
  const args = {
    kind,
    fileName: asset.fileName,
    sha256: asset.sha256,
    size: asset.size,
  };
  const prepared = await mapTool("map_tile_asset_prepare_upload", args);
  assert.deepEqual(prepared.asset, asset);
  await putReviewedAsset(prepared.uploadUrl, prepared.headers, bytes, kind);
  const completed = await mapTool("map_tile_asset_complete_upload", {
    ...args,
    uploadKey: prepared.uploadKey,
  });
  assert.deepEqual(completed, asset);
  console.log("ASSET_VERIFIED", kind);
}
await mapTool("map_tile_model_register", { model });
const current = await mapTool("map_tile_model_get", { id: model.id });
assert.deepEqual(current, model);
console.log("MODEL_REGISTERED_VERIFIED", model.sourceCode, model.id);
