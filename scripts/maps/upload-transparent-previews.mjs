// Direct S3 uploads; tokens and signed URLs are never logged.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { mapTool } from "./mcp_maps_client.mjs";
const base = path.resolve(
  process.argv[2] || "models/collections/transparent-catalogue",
);
const entries = JSON.parse(
  await fs.readFile(path.join(base, "manifest.json"), "utf8"),
);
const catalogue = await mapTool("map_tile_models_list");
const latest = new Map();
for (const m of catalogue) {
  const old = latest.get(m.definitionId);
  if (!old || old.version < m.version) latest.set(m.definitionId, m);
}
const records = JSON.parse(
  await fs
    .readFile(path.join(base, "published.json"), "utf8")
    .catch(() => "[]"),
);
const completed = new Set(
  records.map((r) => r.asset.sha256 + ":" + r.definitionId),
);
const changed = [],
  failures = [];
let cursor = 0;
let journal = Promise.resolve();
function persist() {
  const snapshot = JSON.stringify(records, null, 2) + "\n";
  journal = journal.then(async () => {
    await fs.writeFile(path.join(base, "published.next.json"), snapshot);
    await fs.rename(
      path.join(base, "published.next.json"),
      path.join(base, "published.json"),
    );
  });
  return journal;
}
async function worker() {
  while (cursor < entries.length) {
    const entry = entries[cursor++],
      key = entry.asset.sha256 + ":" + entry.model.definitionId;
    if (completed.has(key)) continue;
    const current = latest.get(entry.model.definitionId);
    if (!current || current.hidden) continue;
    if (current.assets.render.sha256 !== entry.expectedRenderSHA256) {
      changed.push({
        definitionId: current.definitionId,
        id: current.id,
        reason: "render changed",
      });
      continue;
    }
    try {
      if (current.assets.preview.sha256 === entry.asset.sha256) {
        completed.add(key);
        continue;
      }
      const bytes = await fs.readFile(
        path.join(base, "assets", entry.asset.sha256 + ".webp"),
      );
      if (
        bytes.length !== entry.asset.size ||
        createHash("sha256").update(bytes).digest("hex") !== entry.asset.sha256
      )
        throw Error("Preview checksum mismatch");
      const args = {
        kind: "preview",
        fileName: entry.asset.fileName,
        size: entry.asset.size,
        sha256: entry.asset.sha256,
      };
      const prepared = await mapTool("map_tile_asset_prepare_upload", args);
      const put = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: prepared.headers,
        body: bytes,
        signal: AbortSignal.timeout(120000),
      });
      if (!put.ok) throw Error("S3 preview upload: HTTP " + put.status);
      const uploaded = await mapTool("map_tile_asset_complete_upload", {
        ...args,
        uploadKey: prepared.uploadKey,
      });
      const saved = await mapTool("map_tile_model_register_preview", {
        id: current.id,
        expectedRenderSHA256: entry.expectedRenderSHA256,
        asset: uploaded.asset || uploaded,
      });
      for (const role of ["source", "render", "lod"])
        if (saved.assets[role].sha256 !== current.assets[role].sha256)
          throw Error("Preview changed " + role);
      latest.set(saved.definitionId, saved);
      completed.add(key);
      records.push({
        id: saved.id,
        definitionId: saved.definitionId,
        version: saved.version,
        previousId: current.id,
        asset: saved.assets.preview,
      });
      await persist();
      console.log(
        JSON.stringify({
          published: records.length,
          total: entries.length,
          code: saved.sourceCode,
          version: saved.version,
        }),
      );
    } catch (error) {
      if (error.message.includes("revision conflict"))
        changed.push({
          definitionId: current.definitionId,
          id: current.id,
          reason: error.message,
        });
      else failures.push({ code: current.sourceCode, error: error.message });
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
await fs.writeFile(
  path.join(base, "published.json"),
  JSON.stringify(records, null, 2) + "\n",
);
await fs.writeFile(
  path.join(base, "changed.json"),
  JSON.stringify(changed, null, 2) + "\n",
);
await fs.writeFile(
  path.join(base, "upload-failures.json"),
  JSON.stringify(failures, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    published: records.length,
    changed: changed.length,
    failures,
  }),
);
if (failures.length) process.exitCode = 1;
