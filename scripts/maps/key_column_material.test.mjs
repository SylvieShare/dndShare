import test from "node:test";
import assert from "node:assert/strict";
import specs from "./ultimate-columns.json" with { type: "json" };
import { keyGlyphAt, makeKeyColumnPainter } from "./key_column_material.mjs";
test("button recess is red while raised corners, cube side and outer seam remain stone", () => {
  const spec = specs["UD-090"];
  for (const p of [
    [0.0024, -0.0871, 87.7038],
    [-4.5277, 0.0423, 87.6826],
    [0.0024, 4.443, 87.6329],
  ])
    assert.equal(keyGlyphAt(p, [0, 0, 1], spec), true);
  for (const p of [
    [-5.1748, 5.0888, 88.3232],
    [5.0502, -5.1362, 88.3352],
    [-7.7634, 0.0424, 87.6602],
  ])
    assert.equal(keyGlyphAt(p, [0, 0, 1], spec), false);
  assert.equal(keyGlyphAt([0, -6, 87.7], [0, -1, 0], spec), false);
});
test("keyed square column preserves iron chains and masonry backing", () => {
  const paint = makeKeyColumnPainter(specs["UD-090"]);
  assert.equal(
    paint([137, 130, 115], [-10.7709, -11.3857, 53.7445], [0, 0, 1]).part,
    "iron",
  );
  assert.equal(
    paint([137, 130, 115], [-10.6333, -7.8256, 36.6273], [0, 0, 1]).part,
    "stone",
  );
});
test("round column and low pedestal use their own measured recess heights", () => {
  for (const [code, inside, raised] of [
    ["UD-091", [0.0022, -0.0868, 87.6227], [-5.1742, 5.0883, 88.3287]],
    ["UD-092", [0.0003, -0.0348, 37.4866], [-5.5849, 5.5492, 38.1195]],
  ]) {
    const paint = makeKeyColumnPainter(specs[code]);
    assert.equal(paint([137, 130, 115], inside, [0, 0, 1]).part, "glyph");
    assert.equal(paint([137, 130, 115], raised, [0, 0, 1]).part, "stone");
    assert.equal(paint([137, 130, 115], inside, [0, 1, 0]).part, "stone");
    assert.equal(paint([137, 130, 115], [10, 10, 37], [0, 0, 1]).part, "stone");
  }
});
