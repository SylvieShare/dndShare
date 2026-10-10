import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { loadReviewedCaveViews } from "./reviewed_cave_views.mjs";

test("an excluded projected volume leaves the next visible material available", async () => {
  const code = `test-${randomUUID()}`,
    base = path.resolve(
      import.meta.dirname,
      "../../models/collections/lost-cave/bone-views",
      code,
      "top",
    ),
    data = Buffer.alloc(64);
  for (let i = 0; i < 16; i++) data.writeFloatLE(2, i * 4);
  const report = {
    model: { sourceCode: code, assets: { source: { sha256: "test-source" } } },
    cutHeight: 0,
    sourceShiftMM: [0, 0],
  };
  await fs.mkdir(base, { recursive: true });
  try {
    await fs.writeFile(path.join(base, "depth.bin"), data);
    await fs.writeFile(
      path.join(base, "reference.json"),
      JSON.stringify({
        sourceSHA256: "test-source",
        fieldSHA256: createHash("sha256").update(data).digest("hex"),
        cutHeight: 0,
        sourceShiftMM: [0, 0],
        centre: [0, 0, 0],
        right: [1, 0, 0],
        up: [0, 1, 0],
        outward: [0, 0, 1],
        scaleMM: 4,
        size: 4,
      }),
    );
    const common = {
        name: "top",
        toleranceMM: 0.1,
        polygons: [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
          ],
        ],
      },
      match = await loadReviewedCaveViews(report, [
        {
          ...common,
          part: "boulder",
          volumes: [{ min: [0, -2, 1], max: [2, 2, 3] }],
        },
        { ...common, part: "raised", minHeightMM: 3 },
        { ...common, part: "water" },
      ]);
    assert.equal(match([-0.5, 0.5, 2]).part, "water");
    assert.equal(match([0.5, 0.5, 2]).part, "boulder");
    assert.equal(match([0.5, 0.5, 0]), undefined);
  } finally {
    await fs.rm(path.dirname(base), { recursive: true, force: true });
  }
});
