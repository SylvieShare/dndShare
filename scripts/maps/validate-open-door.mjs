import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { doorIO } from "./open-door-assets.mjs";
import specs from "./open-doors.json" with { type: "json" };
import { readGlb, embeddedImage } from "./glb_textures.mjs";
import { rotateDoorPoint } from "./open-door-model.mjs";
const code = process.argv[2];
if (!specs[code]) throw new Error("One reviewed door required");
const dir = path.resolve(
    import.meta.dirname,
    "../../models/collections/open-doors",
    specs[code].code,
  ),
  require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  sharp = require("sharp");
function world(p, m) {
  return [0, 1, 2].map(
    (i) => m[i] * p[0] + m[i + 4] * p[1] + m[i + 8] * p[2] + m[i + 12],
  );
}
function triangleHit(origin, direction, v) {
  const sub = (a, b) => a.map((x, i) => x - b[i]),
    dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    e1 = sub(v[1], v[0]),
    e2 = sub(v[2], v[0]),
    h = cross(direction, e2),
    det = dot(e1, h);
  if (Math.abs(det) < 1e-9) return false;
  const s = sub(origin, v[0]),
    u = dot(s, h) / det;
  if (u < 0 || u > 1) return false;
  const q = cross(s, e1),
    b = dot(direction, q) / det;
  if (b < 0 || u + b > 1) return false;
  const t = dot(e2, q) / det;
  return t > 0 && t < 70;
}
function triangles(doc) {
  let out = [];
  for (const node of doc.getRoot().listNodes())
    if (node.getMesh())
      for (const p of node.getMesh().listPrimitives()) {
        const ids = p.getIndices().getArray(),
          pos = p.getAttribute("POSITION");
        for (let i = 0; i < ids.length; i += 3)
          out.push(
            [...ids.slice(i, i + 3)].map((id) => {
              let v = world(pos.getElement(id, []), node.getWorldMatrix());
              return [v[0] * 35, -v[2] * 35, v[1] * 35];
            }),
          );
      }
  return out;
}
function checkPortal(doc) {
  const faces = triangles(doc);
  for (const y of [-8, 0, 8])
    for (const z of [25, 35, 45])
      assert.equal(
        faces.some((v) => triangleHit([-30, y, z], [1, 0, 0], v)),
        false,
        "doorway blocked at " + y + "," + z,
      );
  assert.ok(
    faces.some((v) => triangleHit([-10, -35, 30], [0, 1, 0], v)),
    "opened leaf missing",
  );
}
for (const tier of ["render", "lod"]) {
  const base = await doorIO.read(
    path.join(dir, "candidates/original", tier + ".glb"),
  );
  checkPortal(base);
  if (code === "UD-011") {
    const closed = await doorIO.read(
        path.resolve(
          dir,
          "../reference/UD-011",
          tier === "render" ? "preview-model.glb" : "lod-preview-model.glb",
        ),
      ),
      before = triangles(closed),
      after = triangles(base);
    let gaps = 0,
      bars = 0;
    for (const y of [-5, -3, -1, 1, 3, 5])
      for (const z of [47, 49, 51]) {
        const blocked = before.some((v) =>
            triangleHit([-30, y, z], [1, 0, 0], v),
          ),
          [x] = rotateDoorPoint([12.95, y, z], specs[code]);
        assert.equal(
          after.some((v) => triangleHit([x, -35, z], [0, 1, 0], v)),
          blocked,
          "inspection-window pattern changed",
        );
        if (blocked) bars++;
        else gaps++;
      }
    assert.ok(gaps > 0 && bars > 0, "both bars and openings must survive");
    console.log("WINDOW_PATTERN", tier, { gaps, bars });
  }
  for (const variant of ["albedo-1536-768", "albedo-1536-768-roughness4"]) {
    const file = path.join(dir, "candidates", variant, tier + ".glb"),
      doc = await doorIO.read(file);
    checkPortal(doc);
    const originalMeshes = base.getRoot().listMeshes(),
      meshes = doc.getRoot().listMeshes();
    assert.equal(meshes.length, originalMeshes.length);
    for (let i = 0; i < meshes.length; i++)
      for (let j = 0; j < meshes[i].listPrimitives().length; j++) {
        const a = originalMeshes[i].listPrimitives()[j],
          b = meshes[i].listPrimitives()[j];
        assert.deepEqual(a.getIndices().getArray(), b.getIndices().getArray());
        for (const s of a.listSemantics())
          assert.deepEqual(
            a.getAttribute(s).getArray(),
            b.getAttribute(s).getArray(),
            s + " changed",
          );
      }
    const ga = readGlb(
        await fs.readFile(path.join(dir, "candidates/original", tier + ".glb")),
      ),
      gb = readGlb(await fs.readFile(file));
    for (let i = 0; i < ga.json.materials.length; i++) {
      const a = ga.json.materials[i],
        b = gb.json.materials[i];
      if (a.normalTexture)
        assert.deepEqual(
          embeddedImage(ga, ga.json.textures[a.normalTexture.index].source),
          embeddedImage(gb, gb.json.textures[b.normalTexture.index].source),
        );
      const ai = a.pbrMetallicRoughness?.metallicRoughnessTexture?.index,
        bi = b.pbrMetallicRoughness?.metallicRoughnessTexture?.index;
      if (ai === undefined) continue;
      const av = await sharp(embeddedImage(ga, ga.json.textures[ai].source))
          .raw()
          .toBuffer({ resolveWithObject: true }),
        bv = await sharp(embeddedImage(gb, gb.json.textures[bi].source))
          .raw()
          .toBuffer({ resolveWithObject: true });
      assert.deepEqual(av.info, bv.info);
      for (let k = 0; k < av.data.length; k++)
        assert.ok(
          k % av.info.channels === 1
            ? Math.abs(av.data[k] - bv.data[k]) <= 2
            : av.data[k] === bv.data[k],
          "packed material channel changed",
        );
    }
  }
}
console.log(
  "OPEN_DOOR_VALIDATED",
  code,
  "both tiers, nine unobstructed doorway rays, leaf, candidate attributes and PBR channels",
);
