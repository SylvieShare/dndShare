import { CONNECTIONS } from "./tileConnections";

export const GEOMETRY_FIELDS = [
  {
    key: "mountDepth",
    label: "Глубина монтажного основания",
    caption: "Основание",
    color: "#dfb878",
  },
  {
    key: "surfaceHeight",
    label: "Высота поверхности",
    caption: "Поверхность",
    color: "#81d7e5",
  },
  {
    key: "maxHeight",
    label: "Полная высота модели",
    caption: "Верх модели",
    color: "#b8a1f2",
  },
  {
    key: "offsetX",
    label: "Смещение модели X",
    caption: "Сдвиг X",
    color: "#eea09b",
  },
  {
    key: "offsetZ",
    label: "Смещение модели Z",
    caption: "Сдвиг Z",
    color: "#97b8ee",
  },
];
const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
export function previewGeometry(model) {
  const width = Math.max(1, Math.min(8, finite(model.width, 1)));
  const height = Math.max(1, Math.min(8, finite(model.height, 1)));
  const mount = Math.max(0, finite(model.mountDepth));
  return {
    width,
    height,
    mount,
    bottom: -mount,
    surface: finite(model.surfaceHeight) - mount,
    top: finite(model.maxHeight) - mount,
    offset: (model.placementOffset || [0, 0]).map((v) => finite(v)),
  };
}
export function previewPorts(model, actualTop = 0) {
  if (model.wallMode === "none") return [];
  const g = previewGeometry(model);
  return CONNECTIONS.flatMap((port, index) =>
    model.wallMode === "edge" && index % 2
      ? []
      : [
          {
            ...port,
            index,
            active: !!(model.wallMask & (1 << index)),
            position: [
              g.width / 2 + (port.x * g.width) / 2,
              Math.max(actualTop, g.top) + 0.24,
              g.height / 2 + (port.y * g.height) / 2,
            ],
          },
        ],
  );
}
export function previewSockets(model) {
  const result = [],
    g = previewGeometry(model);
  (model.supportSlots || []).forEach((slot, index) => {
    const valid =
      slot.x >= 0 &&
      slot.y >= 0 &&
      slot.width >= 1 &&
      slot.height >= 1 &&
      slot.x + slot.width <= g.width &&
      slot.y + slot.height <= g.height &&
      slot.elevation > g.mount &&
      slot.elevation <= Number(model.maxHeight) + 0.001;
    for (let y = 0; y < Math.max(1, Math.min(8, finite(slot.height, 1))); y++)
      for (let x = 0; x < Math.max(1, Math.min(8, finite(slot.width, 1))); x++)
        result.push({
          index,
          x,
          y,
          valid,
          position: [
            finite(slot.x) + x + 0.5,
            finite(slot.elevation) - g.mount + 0.035,
            finite(slot.y) + y + 0.5,
          ],
        });
  });
  return result;
}
export function geometryValue(model, key) {
  return key === "offsetX"
    ? model.placementOffset[0]
    : key === "offsetZ"
      ? model.placementOffset[1]
      : model[key];
}
export function setGeometryValue(model, key, value) {
  const n = Number(value);
  if (key === "offsetX" || key === "offsetZ")
    model.placementOffset[key === "offsetX" ? 0 : 1] = n;
  else model[key] = n;
}
export function layoutPreviewLabels(labels, width, height) {
  const result = labels
    .map((p) => ({
      ...p,
      x: Math.max(72, Math.min(width - 72, p.x)),
      y: Math.max(18, Math.min(height - 18, p.y)),
    }))
    .sort((a, b) => a.y - b.y);
  result.forEach((p, i) => {
    if (i) p.y = Math.max(p.y, result[i - 1].y + 30);
  });
  const excess = Math.max(0, (result.at(-1)?.y || 0) - height + 18);
  result.forEach((p) => {
    p.y -= excess;
  });
  return result;
}
