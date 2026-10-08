// Upload only shadow GLBs directly to S3 through MCP. Existing resources remain immutable.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { mapTool } from "./mcp_maps_client.mjs";
import { prepareShadow } from "./shadow_model.mjs";
const root = path.resolve(import.meta.dirname, "../.."),
  folder =
    process.argv.find((a) => a.startsWith("--base="))?.slice(7) ||
    path.join(root, "models/shadows");
const entries = JSON.parse(
  await fs.readFile(path.join(folder, "manifest.json"), "utf8"),
);
let catalogue = await mapTool("map_tile_models_list"),
  completed = 0;
const files = new Map(),
  prepared = new Map(entries.map((e) => [e.expectedLodSHA256, e]));
async function index(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await index(file);
    else if (/^[a-f0-9]{64}\.glb$/.test(entry.name))
      files.set(entry.name, file);
  }
}
await index(path.join(root, "models"));
const reports = [];
for (const entry of entries) {
  let done = false;
  for (let attempt = 0; attempt < 4 && !done; attempt++) {
    const latest = catalogue.filter(
      (m) =>
        m.collection === entry.collection &&
        m.sourceCode === entry.sourceCode &&
        m.sourceName === entry.sourceName,
    )[0];
    if (!latest || latest.hidden) {
      done = true;
      break;
    }
    const sha = latest.assets.lod.sha256;
    let shape = prepared.get(sha);
    if (!shape) {
      if (!files.has(`${sha}.glb`)) await index(path.join(root, "models"));
      const source = files.get(`${sha}.glb`);
      if (!source)
        throw new Error(`Latest local LOD missing: ${latest.sourceCode}`);
      const temp = path.join(folder, "assets/next.glb");
      shape = await prepareShadow(source, temp);
      await fs.rename(
        temp,
        path.join(folder, "assets", `${shape.asset.sha256}.glb`),
      );
      prepared.set(sha, shape);
    }
    if (latest.assets.shadow?.sha256 === shape.asset.sha256) {
      done = true;
      break;
    }
    const asset = shape.asset,
      bytes = await fs.readFile(
        path.join(folder, "assets", `${asset.sha256}.glb`),
      );
    if (
      createHash("sha256").update(bytes).digest("hex") !== asset.sha256 ||
      bytes.length !== asset.size
    )
      throw new Error(`Shadow checksum mismatch: ${entry.sourceCode}`);
    const args = {
        kind: "shadow",
        fileName: asset.fileName,
        sha256: asset.sha256,
        size: asset.size,
      },
      upload = await mapTool("map_tile_asset_prepare_upload", args);
    const response = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: upload.headers,
      body: bytes,
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok)
      throw new Error(`S3 shadow upload failed: HTTP ${response.status}`);
    const uploaded = await mapTool("map_tile_asset_complete_upload", {
      ...args,
      uploadKey: upload.uploadKey,
    });
    try {
      const revision = await mapTool("map_tile_model_register_shadow", {
        id: latest.id,
        expectedLodSHA256: sha,
        asset: uploaded.asset || uploaded,
      });
      catalogue.splice(
        catalogue.findIndex((m) => m.id === revision.id),
        1,
        revision,
      );
      reports.push({
        id: revision.id,
        code: entry.sourceCode,
        shadow: asset.sha256,
        lod: sha,
      });
      completed++;
      done = true;
      await fs.writeFile(
        path.join(folder, "published.json"),
        JSON.stringify(reports, null, 2) + "\n",
      );
      console.log(
        JSON.stringify({
          published: completed,
          total: entries.length,
          code: entry.sourceCode,
        }),
      );
    } catch (error) {
      if (!error.message.includes("update conflict") || attempt === 3)
        throw error;
      catalogue = await mapTool("map_tile_models_list");
    }
  }
}
await fs.writeFile(
  path.join(folder, "catalogue.json"),
  JSON.stringify(await mapTool("map_tile_models_list"), null, 2) + "\n",
);
console.log(
  JSON.stringify({ published: completed, considered: entries.length }),
);
