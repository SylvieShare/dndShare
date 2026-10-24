import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(
  path.join(root, "models/.map-model-tools-runtime/package.json"),
);
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const folder = path.resolve(process.argv[2]);
const recipes = JSON.parse(
  await fs.readFile(
    path.join(import.meta.dirname, "kobold-family.json"),
    "utf8",
  ),
);
const report = [];
const dressed = new Set([
  "icewind",
  "underling",
  "dragonshield",
  "inventor",
  "sorcerer",
  "vampire",
]);
for (const recipe of recipes) {
  const directory = path.join(folder, recipe.slug);
  const stats = JSON.parse(
    await fs.readFile(path.join(directory, "model-stats.json"), "utf8"),
  );
  const checks = [];
  let clothing;
  if (dressed.has(recipe.slug)) {
    const creation = JSON.parse(
      await fs.readFile(path.join(directory, "creation.json"), "utf8"),
    );
    clothing = creation.roles.map(({ role, clothingFit, coveredBodyFaces }) => {
      assert.ok(
        clothingFit?.attachmentVertices > 20,
        `${recipe.slug} ${role} clothing anchors`,
      );
      assert.ok(clothingFit.maxBodyGap <= clothingFit.limit);
      assert.ok(
        clothingFit.pieces?.length &&
          clothingFit.pieces.every((p) => p.components === 1),
      );
      assert.ok(coveredBodyFaces >= 10, `${recipe.slug} ${role} covered skin`);
      return { role, ...clothingFit, coveredBodyFaces };
    });
    assert.deepEqual(
      new Set(clothing.map((r) => r.role)),
      new Set(["render", "lod", "source", "shadow"]),
    );
  }
  for (const entry of stats) {
    const bytes = await fs.readFile(path.join(directory, entry.file));
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const json = JSON.parse(
      bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
    );
    assert.ok(!(json.buffers || []).some((x) => x.uri), "external buffer");
    assert.ok(!(json.images || []).some((x) => x.uri), "external image");
    const doc = await io.readBinary(bytes),
      r = doc.getRoot();
    assert.equal(r.listAnimations().length, 0);
    assert.equal(r.listSkins().length, 0);
    assert.equal(r.listCameras().length, 0);
    for (const mesh of r.listMeshes())
      for (const primitive of mesh.listPrimitives()) {
        assert.equal(primitive.getMode(), 4);
        assert.ok(
          [...primitive.getAttribute("POSITION").getArray()].every(
            Number.isFinite,
          ),
        );
        if (primitive.getMaterial()?.getBaseColorTexture()) {
          const uv = primitive.getAttribute("TEXCOORD_0");
          assert.ok(uv);
          assert.ok(
            [...uv.getArray()].every(
              (n) => Number.isFinite(n) && n >= -0.001 && n <= 1.001,
            ),
          );
        }
      }
    const limit = { render: 90000, lod: 25000, shadow: 12000, source: 600000 }[
      entry.role
    ];
    assert.ok(
      entry.triangles > 1000 && entry.triangles < limit,
      `${recipe.slug} ${entry.role} triangles`,
    );
    assert.ok(Math.abs(entry.bounds[0][1]) < 0.002, "ground datum");
    assert.ok(entry.bounds[1][1] > 0.5 && entry.bounds[1][1] < 2, "height");
    if (entry.role === "render")
      assert.ok(entry.parts <= 8, "too many draw parts");
    if (entry.role === "shadow") assert.equal(r.listTextures().length, 0);
    if (["render", "lod"].includes(entry.role)) {
      assert.ok(
        r
          .listMaterials()
          .some((m) => m.getBaseColorTexture() && m.getNormalTexture()),
      );
      assert.ok(r.listMaterials().some((m) => m.getMetallicRoughnessTexture()));
    }
    checks.push({
      role: entry.role,
      triangles: entry.triangles,
      parts: entry.parts,
      bytes: entry.bytes,
    });
  }
  const game = stats.find((x) => x.role === "render"),
    lod = stats.find((x) => x.role === "lod");
  const delta = Math.max(
    ...game.bounds.flatMap((v, i) =>
      v.map((p, j) => Math.abs(p - lod.bounds[i][j])),
    ),
  );
  assert.ok(delta < 0.04, `${recipe.slug} LOD silhouette extents: ${delta}`);
  const result = {
    slug: recipe.slug,
    itemIds: recipe.itemIds,
    passed: true,
    lodBoundsDelta: delta,
    assets: checks,
    ...(clothing ? { clothing } : {}),
  };
  await fs.writeFile(
    path.join(directory, "verification.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  report.push(result);
}
await fs.writeFile(
  path.join(folder, "verification.json"),
  JSON.stringify({ passed: true, models: report }, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    passed: true,
    models: report.length,
    itemIds: report.flatMap((r) => r.itemIds),
  }),
);
