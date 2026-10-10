import test from "node:test";
import assert from "node:assert/strict";
import { rasterizeSurface, seedSurfaceGutters } from "./uv_surface.mjs";

function fixture() {
  const data = {
    TEXCOORD_0: [
      [0.427, 0.346],
      [0.4274, 0.3451],
      [0.4274, 0.3459],
      [0.43, 0.345],
      [0.45, 0.345],
      [0.43, 0.37],
    ],
    POSITION: [
      [10, 0, 0],
      [10, 0, 0],
      [10, 0, 0],
      [20, 0, 0],
      [20, 0, 0],
      [20, 0, 0],
    ],
    NORMAL: Array.from({ length: 6 }, () => [0, 1, 0]),
    COLOR_0: Array.from({ length: 6 }, () => [1, 1, 1, 1]),
    COLOR_1: [
      ...Array.from({ length: 3 }, () => [.2, .06, .02, 1]),
      ...Array.from({ length: 3 }, () => [.15, .55, .025, 1]),
    ],
  };
  const primitive = {
    getMaterial: () => ({
      getBaseColorTexture: () => ({}),
      getBaseColorTextureInfo: () => ({
        getTexCoord: () => 0,
        getExtension: () => null,
      }),
    }),
    getIndices: () => ({ getCount: () => 6, getScalar: (i) => i }),
    getAttribute: (name) => ({ getElement: (i) => data[name][i] }),
  };
  return {
    getRoot: () => ({
      listNodes: () => [
        {
          getWorldMatrix: () => [
            1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
          ],
          getMesh: () => ({ listPrimitives: () => [primitive] }),
        },
      ],
    }),
  };
}

test("subpixel wall triangles seed their own gutters without replacing used crystal texels", () => {
  const doc = fixture(),
    size = 128;
  const colours = new Map();
  const coverage = rasterizeSurface(doc, size, size, (i, p) =>
    colours.set(i, p[0]),
  );
  assert(![...colours.values()].includes(350));
  const original = new Map(colours);
  const seeded = seedSurfaceGutters(doc, size, size, coverage, (i, p, n) => {
    assert(Math.abs(Math.hypot(...n) - 1) < 1e-8);
    colours.set(i, p[0]);
  });
  assert([...colours.values()].includes(350));
  for (const [i, value] of original) assert.equal(colours.get(i), value);
  assert(
    seeded.reduce((a, b) => a + b, 0) > coverage.reduce((a, b) => a + b, 0),
  );
});

test("named Paint colours seed tiny timber islands beside green fruit without replacing used pixels", () => {
  const doc = fixture(), size = 128, colours = new Map();
  const coverage = rasterizeSurface(doc,size,size,(i,p,n,rgba) => colours.set(i,rgba),"BaseColor","COLOR_1");
  const original = new Map(colours);
  seedSurfaceGutters(doc,size,size,coverage,(i,p,n,rgba) => {
    const expected = p[0]<500 ? [.2,.06,.02,1] : [.15,.55,.025,1];
    for (let c=0;c<4;c++) assert(Math.abs(rgba[c]-expected[c])<1e-8);
    colours.set(i,rgba);
  },1,"BaseColor","COLOR_1");
  assert([...colours.values()].some(c => Math.abs(c[0]-.2)<1e-8));
  for (const [i,rgba] of original) assert.deepEqual(colours.get(i),rgba);
});
