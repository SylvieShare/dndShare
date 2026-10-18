import { expect, it } from "vitest";
import {
  buildVolumeFogField,
  volumeFogColumns,
  FOG_FIELD_LIMIT,
  applyVolumeFogWeights,
} from "./volumeFogField";
function sample(field, p) {
  const [x, y, z] = p.map((n, a) =>
    Math.min(
      field.dimensions[a] - 1,
      Math.max(
        0,
        Math.floor(((n - field.min[a]) / field.size[a]) * field.dimensions[a]),
      ),
    ),
  );
  return field.data[(z * field.dimensions[1] + y) * field.dimensions[0] + x];
}
it("builds an actual volume above rotated multi-cell tiles and retains their raised floor without fog below it", () => {
  const d = {
    areas: [
      { fog: true, tileIds: ["bridge"] },
      { fog: false, tileIds: ["disabled"] },
      { fog: true, hidden: true, tileIds: ["hidden"] },
    ],
  };
  const tiles = ["bridge", "disabled", "hidden"].map((id) => ({
    id,
    modelId: "bridge",
    x: 2,
    y: 3,
    elevation: 4,
    rotation: 90,
  }));
  const columns = volumeFogColumns(d, tiles, [
    { id: "bridge", width: 3, height: 1, maxHeight: 0.5, mountDepth: 0.1 },
  ]);
  expect(columns).toHaveLength(1);
  expect(columns[0].max[0] - columns[0].min[0]).toBe(1);
  expect(columns[0].max[2] - columns[0].min[2]).toBe(3);
  const field = buildVolumeFogField(columns);
  expect(sample(field, [2.5, 4.65, 4.5])).toBeGreaterThan(150);
  expect(field.min[1]).toBeGreaterThan(3);
  expect(sample(field, [2.5, 3.3, 4.5])).toBe(0);
});
it("merges adjacent columns without seams while leaving disconnected gaps empty and bounding GPU memory", () => {
  const columns = [0, 1, 5].map((x) => ({
      min: [x, 0, 0],
      max: [x + 1, 2, 1],
    })),
    field = buildVolumeFogField(columns);
  expect(sample(field, [1, 0.8, 0.5])).toBe(255);
  expect(sample(field, [3.5, 0.8, 0.5])).toBe(0);
  const broad = buildVolumeFogField([{ min: [0, 0, 0], max: [300, 40, 300] }]);
  expect(broad.dimensions).toEqual(FOG_FIELD_LIMIT);
  expect(broad.data.byteLength).toBe(192 * 96 * 192);
  expect(buildVolumeFogField([])).toBe(null);
});

it("follows the pending tile position and height before a drag is committed", () => {
  const document = {
    areas: [{ fog: true, tileIds: ["a"] }],
  };
  const tile = {
    id: "a",
    modelId: "floor",
    x: 0,
    y: 0,
    elevation: 0,
    rotation: 0,
  };
  const columns = volumeFogColumns(
    document,
    [tile],
    [{ id: "floor", width: 1, height: 1 }],
    [{ ...tile, x: 4, y: 3, elevation: 2 }],
  );
  expect(columns[0].min[0]).toBe(4);
  expect(columns[0].min[2]).toBe(3);
  expect(columns[0].min[1]).toBeCloseTo(1.86);
  expect(tile).toMatchObject({ x: 0, y: 0, elevation: 0 });
});

it("fades adjacent areas independently with reusable sparse density masks", () => {
  const field = buildVolumeFogField([
    { areaId: "a", min: [0, 0, 0], max: [1, 2, 1] },
    { areaId: "b", min: [1, 0, 0], max: [2, 2, 1] },
  ]);
  applyVolumeFogWeights(field, (id) => (id === "a" ? 0.5 : 1));
  expect(sample(field, [0.25, 0.8, 0.5])).toBeCloseTo(128, 0);
  expect(sample(field, [1.75, 0.8, 0.5])).toBe(255);
  applyVolumeFogWeights(field, (id) => (id === "a" ? 0 : 1));
  expect(sample(field, [0.25, 0.8, 0.5])).toBe(0);
  expect(sample(field, [1.75, 0.8, 0.5])).toBe(255);
});
