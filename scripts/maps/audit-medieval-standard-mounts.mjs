import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { isDeepStrictEqual } from "node:util";
import {
  STANDARD_MOUNT,
  standardMountMetadata,
  validateStandardMount,
  verifyStandardMountBody,
  standardMountAssetInfo,
} from "./standard_mount.mjs";
import { readGlb } from "./glb_textures.mjs";
import { mapTool } from "./mcp_maps_client.mjs";
const base = path.resolve(
    import.meta.dirname,
    "../../models/collections/medieval-town-vol1",
  ),
  partial = process.argv.includes("--completed-only"),
  req = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  sharp = req("sharp");
async function readJSON(file) {
  for (let i = 0; i < 4; i++) {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch (e) {
      if (!(e instanceof SyntaxError) || i === 3) throw e;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}
const registry = partial
    ? await readJSON(path.join(base, "registry-snapshot.json"))
    : await mapTool("map_tile_models_list"),
  progress = await readJSON(path.join(base, "mount-standard-progress.json")),
  inventory = await readJSON(path.join(base, "inventory.json")),
  expected = inventory.filter((r) => Number(r.code.slice(4)) <= 70),
  out = {
    checkedAt: new Date().toISOString(),
    complete: !partial,
    models: [],
    behaviourChangesAfterConfirmation: [],
  };
if (!partial) {
  assert.equal(expected.length, 70);
  assert.equal(progress.filter((r) => r.status === "verified").length, 70);
}
const hash = (b) => createHash("sha256").update(b).digest("hex");
async function hashFile(file) {
  const h = createHash("sha256");
  for await (const b of createReadStream(file)) h.update(b);
  return h.digest("hex");
}
function withoutAssets(m) {
  const { assets, ...rest } = m;
  return rest;
}
function sameBodyDescriptors(before, after) {
  const a = readGlb(before).json,
    b = readGlb(after).json;
  for (let i = 0; i < a.nodes.length; i++) {
    const n = a.nodes[i];
    if (n.mesh === undefined) continue;
    const m = a.meshes[n.mesh];
    if (
      m.primitives.some((p) =>
        /^(Insertion earth|Simple insertion pegs)/.test(
          a.materials?.[p.material]?.name ?? "",
        ),
      )
    )
      continue;
    assert.ok(b.nodes[i].mesh !== undefined);
    assert.deepEqual(
      b.meshes[b.nodes[i].mesh],
      m,
      "Body topology, material binding or attribute descriptors changed",
    );
  }
}
for (const row of expected) {
  const m = registry.find(
      (m) => m.sourceCode === row.code && m.collection === row.collection,
    ),
    status = progress.find((r) => r.code === row.code);
  if (
    partial &&
    !(status?.status === "verified" && m?.mountDepth === STANDARD_MOUNT.depth)
  )
    continue;
  assert.ok(m);
  assert.equal(m.mountDepth, STANDARD_MOUNT.depth);
  const dir = path.join(base, "mount-standard", row.code),
    r = await readJSON(path.join(dir, "report.json")),
    canonical = await readJSON(
      path.join(base, "review", row.code, "report.json"),
    );
  assert.ok(
    r.publication?.assetsVerified && canonical.publication?.assetsVerified,
  );
  assert.deepEqual(r.model, m);
  assert.deepEqual(canonical.model, m);
  assert.deepEqual(
    withoutAssets(m),
    withoutAssets(standardMountMetadata(r.originalModel)),
  );
  assert.equal(m.id, r.originalModel.id);
  assert.equal(m.definitionId, r.originalModel.definitionId);
  assert.deepEqual(m.assets.source, r.originalModel.assets.source);
  assert.equal(m.assets.source.sha256, row.sourceSHA256);
  for (const kind of ["source", "render", "lod", "shadow", "preview"]) {
    const a = m.assets[kind],
      file = path.join(base, "upload", row.code, path.basename(a.key));
    assert.equal((await fs.stat(file)).size, a.size);
    assert.equal(
      await hashFile(file),
      a.sha256,
      "Local asset differs from current server SHA",
    );
  }
  const proof = {
    code: row.code,
    uuid: m.id,
    sourceSHA256: m.assets.source.sha256,
    oldMountDepth: r.originalModel.mountDepth,
    mountDepth: m.mountDepth,
    tiers: {},
  };
  for (const tier of ["render", "lod"]) {
    const before = await fs.readFile(path.join(dir, "input-" + tier + ".glb")),
      after = await fs.readFile(
        path.join(base, "upload", row.code, path.basename(m.assets[tier].key)),
      );
    assert.equal(hash(before), r.originalModel.assets[tier].sha256);
    const geometry = await validateStandardMount(after, m),
      body = await verifyStandardMountBody(before, after, r.originalModel, m);
    sameBodyDescriptors(before, after);
    proof.tiers[tier] = {
      sha256: m.assets[tier].sha256,
      ...geometry,
      ...body,
      bodyTopologyAndBindingsUnchanged: true,
    };
  }
  const shadowBytes = await fs.readFile(
      path.join(base, "upload", row.code, path.basename(m.assets.shadow.key)),
    ),
    shadow = readGlb(shadowBytes);
  assert.equal(shadow.json.materials?.length ?? 0, 0);
  assert.equal(shadow.json.images?.length ?? 0, 0);
  const shadowInfo = await standardMountAssetInfo(shadowBytes),
    lodInfo = await standardMountAssetInfo(
      await fs.readFile(path.join(dir, "lod.glb")),
    );
  assert.equal(shadowInfo.triangles, lodInfo.triangles);
  for (const side of ["min", "max"])
    for (let i = 0; i < 3; i++)
      assert.ok(
        Math.abs(shadowInfo.bounds[side][i] - lodInfo.bounds[side][i]) < 0.0001,
        "Shadow bounds drift",
      );
  proof.shadowTriangles = shadowInfo.triangles;
  const bytes = await fs.readFile(
      path.join(base, "upload", row.code, path.basename(m.assets.preview.key)),
    ),
    { data, info } = await sharp(bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  assert.ok((await sharp(bytes).metadata()).hasAlpha);
  let visible = 0,
    empty = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a) visible++;
      else empty++;
      if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1)
        assert.equal(a, 0);
    }
  assert.ok(visible && empty);
  if (!partial) {
    const current = (
        await mapTool("map_tile_model_behaviour_get", {
          definitionId: m.definitionId,
        })
      ).behaviour,
      { confirmedAt, definitionId, ...confirmed } = r.behaviourPublication;
    proof.currentBehaviourRevision = current.revision;
    proof.behaviourStillMatchesConfirmed = isDeepStrictEqual(
      current,
      confirmed,
    );
    if (!proof.behaviourStillMatchesConfirmed)
      out.behaviourChangesAfterConfirmation.push({
        code: row.code,
        confirmed,
        current,
      });
  }
  out.models.push(proof);
  console.log(
    "STANDARD_AUDIT",
    row.code,
    proof.tiers.render.pads,
    Math.max(
      proof.tiers.render.maximumWorldDriftMM,
      proof.tiers.lod.maximumWorldDriftMM,
    ),
  );
}
if (!partial) assert.equal(out.models.length, 70);
out.maximumWorldDriftMM = Math.max(
  ...out.models.flatMap((r) => [
    r.tiers.render.maximumWorldDriftMM,
    r.tiers.lod.maximumWorldDriftMM,
  ]),
);
out.padCount = out.models.reduce((n, m) => n + m.tiers.render.pads, 0);
await fs.writeFile(
  path.join(
    base,
    partial
      ? "mount-standard-audit-progress.json"
      : "mount-standard-final-audit.json",
  ),
  JSON.stringify(out, null, 2) + "\n",
);
console.log(
  "STANDARD_AUDIT_DONE",
  out.models.length,
  "models",
  out.padCount,
  "pads",
  "maxWorldDriftMM",
  out.maximumWorldDriftMM,
  "laterBehaviourChanges",
  out.behaviourChangesAfterConfirmation.length,
);
