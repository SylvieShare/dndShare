import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mountingSurface } from "./mounting_surface.mjs";
import { assertSameSurface } from "./surface_geometry.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { Document } = require("@gltf-transform/core");
function doc(indices) {
  const d = new Document();
  const pos = d
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]));
  const p = d
    .createPrimitive()
    .setAttribute("POSITION", pos)
    .setIndices(
      d.createAccessor().setType("SCALAR").setArray(Uint16Array.from(indices)),
    )
    .setMaterial(d.createMaterial("Simple insertion pegs"));
  const n = d.createNode().setMesh(d.createMesh().addPrimitive(p));
  d.createScene().addChild(n);
  return d;
}
test("duplicate mounting faces may be imported once, while every distinct triangle remains required", () => {
  const before = doc([0, 1, 2, 0, 1, 2, 2, 1, 3]);
  const after = doc([0, 1, 2, 2, 1, 3]);
  assert.throws(() => assertSameSurface(before, after));
  assert.equal(
    assertSameSurface(mountingSurface(before), mountingSurface(after))
      .triangles,
    2,
  );
  assert.throws(() =>
    assertSameSurface(mountingSurface(before), mountingSurface(doc([0, 1, 2]))),
  );
});
