import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import {
  texturePolicy,
  textureMeasurements,
  checkTextureBudget,
} from "./texture_policy.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(
  path.join(root, "models/.map-model-tools-runtime/package.json"),
);
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const sharp = require("sharp");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const folder = path.resolve(process.argv[2]);
const recipe = process.argv[3]
  ? JSON.parse(await fs.readFile(process.argv[3], "utf8"))
  : {};
const stats = JSON.parse(
  await fs.readFile(path.join(folder, "model-stats.json")),
);
const placement = JSON.parse(
  await fs.readFile(path.join(folder, "placement.json")),
);
const limits = { render: 90000, lod: 25000, shadow: 12000, source: 600000 };
const policy = texturePolicy(recipe),
  textureUsage = {};
assert.equal(placement.embeddedBase, false);
assert.ok(
  recipe.referenceDiameter > 0 && recipe.referenceDiameter <= 32,
  "reviewed reference diameter",
);
if (placement.referenceDiameter !== undefined)
  assert.equal(placement.referenceDiameter, recipe.referenceDiameter);
assert.equal(stats.length, 4);
const hashes = {};
for (const entry of stats) {
  const bytes = await fs.readFile(path.join(folder, entry.file));
  hashes[entry.role] = crypto.createHash("sha256").update(bytes).digest("hex");
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const json = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  );
  assert.ok(!(json.buffers || []).some((b) => b.uri), "external buffer");
  assert.ok(!(json.images || []).some((i) => i.uri), "external image");
  const doc = await io.readBinary(bytes),
    r = doc.getRoot();
  const textures = await textureMeasurements(doc, (data) =>
    sharp(data).metadata(),
  );
  textureUsage[entry.role] =
    entry.role === "shadow"
      ? 0
      : checkTextureBudget(entry.role, textures, policy);
  assert.equal(
    entry.textureMemoryBytes,
    textureUsage[entry.role],
    "stale texture memory statistics",
  );
  assert.deepEqual(entry.textures, textures, "stale texture dimensions");
  let triangles = 0,
    parts = 0;
  const low = [Infinity, Infinity, Infinity],
    high = [-Infinity, -Infinity, -Infinity];
  if (recipe.materialProfile === "dielectric")
    for (const material of r.listMaterials())
      assert.equal(
        material.getMetallicFactor(),
        0,
        `${entry.role}: dielectric metalness`,
      );
  assert.equal(r.listAnimations().length, 0);
  assert.equal(r.listSkins().length, 0);
  assert.equal(r.listCameras().length, 0);
  assert.ok(entry.triangles > 1000 && entry.triangles <= limits[entry.role]);
  assert.ok(Math.abs(entry.bounds[0][1]) < 0.005, "foot datum");
  assert.ok(
    entry.bounds[1][1] > 0.2 && entry.bounds[1][1] < 2,
    "native height",
  );
  assert.ok(entry.parts <= 4, "draw parts");
  for (const node of r.listNodes())
    for (const p of node.getMesh()?.listPrimitives() || []) {
      parts++;
      const pos = p.getAttribute("POSITION"),
        point = [],
        m = node.getWorldMatrix();
      triangles += (p.getIndices()?.getCount() || pos.getCount()) / 3;
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, point);
        assert.ok(point.every(Number.isFinite), "invalid coordinate");
        const x = m[0] * point[0] + m[4] * point[1] + m[8] * point[2] + m[12];
        const z = m[2] * point[0] + m[6] * point[1] + m[10] * point[2] + m[14];
        const y = m[1] * point[0] + m[5] * point[1] + m[9] * point[2] + m[13];
        for (const [axis, value] of [x, y, z].entries()) {
          assert.ok(Number.isFinite(value), "invalid world coordinate");
          low[axis] = Math.min(low[axis], value);
          high[axis] = Math.max(high[axis], value);
        }
      }
      if (["render", "lod"].includes(entry.role)) {
        const uv = p.getAttribute("TEXCOORD_0");
        assert.ok(
          uv &&
            [...uv.getArray()].every(
              (n) => Number.isFinite(n) && n >= -0.001 && n <= 1.001,
            ),
        );
        const material = p.getMaterial();
        assert.ok(
          material.getBaseColorTexture() && material.getNormalTexture(),
        );
        assert.ok(
          material.getMetallicRoughnessTexture() ||
            (material.getMetallicFactor() === 0 &&
              material.getRoughnessFactor() >= 0.7),
          "matte PBR texture or constant dielectric factors",
        );
      }
    }
  assert.equal(triangles, entry.triangles, "stale triangle statistics");
  assert.equal(parts, entry.parts, "stale part statistics");
  assert.equal(bytes.length, entry.bytes, "stale byte statistics");
  assert.ok(
    [low, high].every((v, i) =>
      v.every((n, j) => Math.abs(n - entry.bounds[i][j]) < 1e-5),
    ),
    "stale geometry bounds",
  );
  if (entry.role === "shadow") assert.equal(r.listTextures().length, 0);
}
const render = stats.find((s) => s.role === "render"),
  lod = stats.find((s) => s.role === "lod");
const delta = Math.max(
  ...render.bounds.flatMap((v, i) =>
    v.map((n, j) => Math.abs(n - lod.bounds[i][j])),
  ),
);
assert.ok(delta < 0.04, `LOD bounds delta ${delta}`);
const silhouetteBytes = await fs.readFile(
  path.join(folder, "lod-silhouette.json"),
);
const silhouette = JSON.parse(silhouetteBytes);
const silhouettePolicy = {
  ...JSON.parse(
    await fs.readFile(
      path.join(import.meta.dirname, "lod-silhouette-policy.json"),
    ),
  ),
  ...recipe.lodSilhouette,
};
assert.equal(silhouette.schema, 1, "silhouette report schema");
assert.equal(silhouette.mode, "opaque-geometry", "silhouette comparison mode");
assert.equal(silhouette.passed, true, "LOD silhouette comparison failed");
assert.deepEqual(
  silhouette.policy,
  silhouettePolicy,
  "silhouette policy changed",
);
assert.equal(silhouette.views.length, 17, "missing silhouette views");
for (const role of ["render", "lod"])
  assert.equal(
    silhouette.assetHashes[role],
    hashes[role],
    "silhouette report is stale",
  );
const result = {
  passed: true,
  originalServiceMeshExported: !!placement.originalServiceMeshExported,
  nominalFootprintCells: placement.nominalFootprintCells,
  referenceDiameter: recipe.referenceDiameter,
  maxHeight: render.bounds[1][1],
  lodBoundsDelta: delta,
  assetHashes: hashes,
  silhouetteReportSHA256: crypto
    .createHash("sha256")
    .update(silhouetteBytes)
    .digest("hex"),
  silhouette: {
    passed: true,
    views: 17,
    minIoU: silhouette.minIoU,
    maxDistancePixels: silhouette.maxDistancePixels,
  },
  assets: stats,
  textureBudget: {
    passed: true,
    policy,
    rgbaMipBytes: textureUsage,
    override: recipe.texturePolicy || null,
    policySHA256: crypto
      .createHash("sha256")
      .update(
        await fs.readFile(new URL("./texture-policy.json", import.meta.url)),
      )
      .digest("hex"),
  },
};
await fs.writeFile(
  path.join(folder, "verification.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    passed: true,
    lodBoundsDelta: delta,
    roles: stats.map(({ role, triangles, bytes }) => ({
      role,
      triangles,
      bytes,
    })),
  }),
);
