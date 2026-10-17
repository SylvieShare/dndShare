import { tileSize } from "../lib/tilePlacementSize";

export const FOG_FIELD_LIMIT = [192, 96, 192];
const feather = 0.32;
const smooth = (value) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
export function volumeFogColumns(document, placed, catalogue, previews = []) {
  const ids = new Set(
    document.areas
      .filter((a) => a.fog && a.fogStyle === "volume" && !a.hidden)
      .flatMap((a) => a.tileIds),
  );
  if (!ids.size) return [];
  const models = new Map(catalogue.map((m) => [m.id, m])),
    moving = new Map(previews.map((t) => [t.id, t]));
  return placed
    .filter((t) => ids.has(t.id))
    .map((tile) => {
      tile = moving.get(tile.id) || tile;
      const model = models.get(tile.modelId),
        size = tileSize(tile, model),
        floor = tile.elevation || 0;
      const height = Math.max(
        0.2,
        (model?.maxHeight || 0.4) - (model?.mountDepth || 0),
      );
      return {
        min: [tile.x, floor - 0.14, tile.y],
        max: [
          tile.x + size.width,
          floor + Math.max(1.25, height + 0.9),
          tile.y + size.height,
        ],
      };
    });
}
export function buildVolumeFogField(columns) {
  if (!columns.length) return null;
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const column of columns)
    for (let axis = 0; axis < 3; axis++) {
      const pad = axis === 1 ? 0.55 : feather + 0.55;
      min[axis] = Math.min(min[axis], column.min[axis] - pad);
      max[axis] = Math.max(max[axis], column.max[axis] + pad);
    }
  const size = max.map((n, axis) => n - min[axis]);
  const dimensions = size.map((n, axis) =>
    Math.max(
      4,
      Math.min(FOG_FIELD_LIMIT[axis], Math.ceil(n * (axis === 1 ? 5 : 4))),
    ),
  );
  const [nx, ny, nz] = dimensions,
    step = size.map((n, axis) => n / dimensions[axis]),
    data = new Uint8Array(nx * ny * nz);
  for (const column of columns) {
    const lo = column.min.map((n, axis) =>
      Math.max(
        0,
        Math.floor((n - (axis === 1 ? 0 : feather) - min[axis]) / step[axis]),
      ),
    );
    const hi = column.max.map((n, axis) =>
      Math.min(
        dimensions[axis] - 1,
        Math.ceil((n + (axis === 1 ? 0 : feather) - min[axis]) / step[axis]),
      ),
    );
    for (let z = lo[2]; z <= hi[2]; z++)
      for (let y = lo[1]; y <= hi[1]; y++)
        for (let x = lo[0]; x <= hi[0]; x++) {
          const px = min[0] + (x + 0.5) * step[0],
            py = min[1] + (y + 0.5) * step[1],
            pz = min[2] + (z + 0.5) * step[2];
          const edge = Math.min(
            px - column.min[0],
            column.max[0] - px,
            pz - column.min[2],
            column.max[2] - pz,
          );
          const outside = Math.hypot(
            Math.max(column.min[0] - px, 0, px - column.max[0]),
            Math.max(column.min[2] - pz, 0, pz - column.max[2]),
          );
          const density =
            smooth(edge < 0 ? 1 - outside / feather : 1) *
            smooth((py - column.min[1]) / 0.2) *
            smooth((column.max[1] - py) / 0.65);
          const index = (z * ny + y) * nx + x;
          data[index] = Math.max(data[index], Math.round(density * 255));
        }
  }
  return { min, max, size, dimensions, data };
}
