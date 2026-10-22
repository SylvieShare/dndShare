import test from "node:test";
import assert from "node:assert/strict";
import {
  medievalTextureSizes,
  medievalColourQuality,
} from "./medieval_texture_sizes.mjs";

const recipe = { renderBakeSize: 1024, lodBakeSize: 512 };

test("existing balanced and compact budgets remain unchanged", () => {
  assert.deepEqual(medievalTextureSizes(recipe, "render"), {
    colourSize: 1024,
    dataSize: 512,
  });
  assert.deepEqual(medievalTextureSizes(recipe, "lod"), {
    colourSize: 512,
    dataSize: 256,
  });
  assert.deepEqual(medievalTextureSizes(recipe, "render", "compact"), {
    colourSize: 768,
    dataSize: 384,
  });
  assert.deepEqual(medievalTextureSizes(recipe, "lod", "compact"), {
    colourSize: 384,
    dataSize: 192,
  });
});

test("existing independent data overrides retain their sizes", () => {
  const r = { ...recipe, lodDataSize: 512 };
  assert.deepEqual(medievalTextureSizes(r, "lod"), {
    colourSize: 512,
    dataSize: 512,
  });
  assert.deepEqual(medievalTextureSizes(r, "lod", "compact"), {
    colourSize: 384,
    dataSize: 384,
  });
});

test("larger LOD colour preserves an independent data budget", () => {
  const r = {
    ...recipe,
    lodBakeSize: 1024,
    lodColourSize: 1024,
    lodDataSize: 256,
  };
  assert.deepEqual(medievalTextureSizes(r, "lod"), {
    colourSize: 1024,
    dataSize: 256,
  });
  assert.deepEqual(medievalTextureSizes(r, "lod", "compact"), {
    colourSize: 768,
    dataSize: 192,
  });
  assert.equal(r.lodColourSize, 1024);
});

test("explicit maps cannot exceed their source bake or use fractional compact dimensions", () => {
  for (const kind of ["Colour", "Data"]) {
    for (const value of [-4, 0, 3, 512.5, 1024]) {
      assert.throws(() =>
        medievalTextureSizes(
          { ...recipe, ["lod" + kind + "Size"]: value },
          "lod",
        ),
      );
    }
    assert.throws(() =>
      medievalTextureSizes(
        { ...recipe, ["lod" + kind + "Size"]: 510 },
        "lod",
        "compact",
      ),
    );
    assert.throws(() =>
      medievalTextureSizes({ ["lod" + kind + "Size"]: 512 }, "lod"),
    );
  }
});

test("invalid tiers, candidates and fractional default data maps are rejected", () => {
  assert.throws(() => medievalTextureSizes(recipe, "shadow"));
  assert.throws(() => medievalTextureSizes(recipe, "lod", "unknown"));
  assert.throws(() =>
    medievalTextureSizes({ ...recipe, lodColourSize: 4 }, "lod", "compact"),
  );
});
test("colour quality preserves defaults and permits precise dark-detail LOD encoding", () => {
  assert.equal(medievalColourQuality({}, "render"), 94);
  assert.equal(medievalColourQuality({ lodColourQuality: 100 }, "render"), 94);
  assert.equal(medievalColourQuality({ lodColourQuality: 100 }, "lod"), 100);
  for (const value of [0, 101, 94.5, "100"])
    assert.throws(() =>
      medievalColourQuality({ lodColourQuality: value }, "lod"),
    );
  assert.throws(() => medievalColourQuality({}, "shadow"));
});
