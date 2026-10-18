import { tileSize } from "../lib/tilePlacementSize";

export const FOG_FIELD_LIMIT = [192, 96, 192];
const feather = 0.32;
const smooth = (value) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
export function volumeFogColumns(
  document,
  placed,
  catalogue,
  previews = [],
  motion,
) {
  const owners = new Map();
  for (const area of document.areas) {
    const active = motion
      ? (area.fog || motion.fogActive(area.id)) &&
        (!area.hidden || motion.visibility(area.id) > 0)
      : area.fog && !area.hidden;
    if (active) for (const id of area.tileIds) owners.set(id, area.id || "");
  }
  const ids = new Set(owners.keys());
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
        areaId: owners.get(tile.id),
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
  const grouped = new Map(),
    masks = new Map(),
    scratch = new Uint8Array(data.length);
  for (const column of columns) {
    const id = column.areaId || "";
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(column);
  }
  for (const [id, areaColumns] of grouped) {
    const chunks = [];
    let count = 0;
    for (const column of areaColumns) {
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
            const value = Math.round(density * 255);
            if (!value) continue;
            if (!scratch[index]) {
              if (count % 1024 === 0) chunks.push(new Uint32Array(1024));
              chunks[chunks.length - 1][count % 1024] = index;
              count++;
            }
            scratch[index] = Math.max(scratch[index], value);
          }
    }
    const compact = chunks.map((chunk, i) =>
      chunk.subarray(0, Math.min(1024, count - i * 1024)),
    );
    for (const chunk of compact)
      for (let i = 0; i < chunk.length; i++) {
        const index = chunk[i],
          density = scratch[index];
        chunk[i] = (density << 22) | index;
        data[index] = Math.max(data[index], density);
        scratch[index] = 0;
      }
    masks.set(id, compact);
  }
  return { min, max, size, dimensions, data, masks };
}
export function applyVolumeFogWeights(field, weightFor) {
  field.data.fill(0);
  for (const [id, chunks] of field.masks) {
    const weight = weightFor(id);
    if (weight <= 0) continue;
    for (const chunk of chunks)
      for (const packed of chunk) {
        const index = packed & 0x3fffff,
          value = Math.round((packed >>> 22) * weight);
        field.data[index] = Math.max(field.data[index], value);
      }
  }
}
