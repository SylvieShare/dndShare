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
const stats = JSON.parse(
  await fs.readFile(path.join(folder, "model-stats.json")),
);
const placement = JSON.parse(
  await fs.readFile(path.join(folder, "placement.json")),
);
const limits = { render: 90000, lod: 25000, shadow: 12000, source: 600000 };
assert.equal(placement.embeddedBase, false);
assert.equal(stats.length, 4);
for (const entry of stats) {
  const bytes = await fs.readFile(path.join(folder, entry.file));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const json = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  );
  assert.ok(!(json.buffers || []).some((b) => b.uri), "external buffer");
  assert.ok(!(json.images || []).some((i) => i.uri), "external image");
  const doc = await io.readBinary(bytes),
    r = doc.getRoot();
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
      const pos = p.getAttribute("POSITION"),
        point = [],
        m = node.getWorldMatrix();
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, point);
        assert.ok(point.every(Number.isFinite), "invalid coordinate");
        const x = m[0] * point[0] + m[4] * point[1] + m[8] * point[2] + m[12];
        const z = m[2] * point[0] + m[6] * point[1] + m[10] * point[2] + m[14];
        assert.ok(
          Math.hypot(x, z) <= placement.nativeFootprintDiameter / 2 + 0.02,
          "base overhang",
        );
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
const result = {
  passed: true,
  originalServiceMeshExported: false,
  nominalFootprintCells: placement.nominalFootprintCells,
  lodBoundsDelta: delta,
  assets: stats,
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
