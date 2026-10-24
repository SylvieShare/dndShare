import { pruneDecals } from "./mapDecals";
export const OBJECTS = [{ id: "chest", name: "Сундук" }];
export const clone = (value) => JSON.parse(JSON.stringify(value));
export const uid = () => crypto.randomUUID();
export const interactive = (kind) =>
  ["door", "double-door", "portcullis", "chest", "torch"].includes(kind);
export function newMap() {
  return {
    name: "Новая карта",
    document: {
      version: 2,
      kind: "tiles",
      tags: [],
      width: 30,
      height: 22,
      grid: { visible: true },
      tiles: [],
      objects: [],
      zones: [],
      areas: [],
      lightingEnabled: false,
      sun: { enabled: true, angle: 225, elevation: 45 },
      lights: [],
    },
    revision: 0,
  };
}
export function initialState() {
  return {
    useCreatureBases: false,
    fog: true,
    defaultVisibility: "hidden",
    zones: {},
    objects: {},
    tokens: [],
  };
}
export function inside(d, x, y) {
  return x >= 0 && y >= 0 && x < d.width && y < d.height;
}
export function snap(d, p, size = 1) {
  const x = Math.round(p.x - size / 2) + size / 2;
  const y = Math.round(p.y - size / 2) + size / 2;
  return {
    x:
      size > d.width
        ? d.width / 2
        : Math.max(size / 2, Math.min(d.width - size / 2, x)),
    y:
      size > d.height
        ? d.height / 2
        : Math.max(size / 2, Math.min(d.height - size / 2, y)),
  };
}
export function zoneContains(d, z, x, y) {
  const cx = Math.floor(x),
    cy = Math.floor(y);
  const cell = cy * Math.ceil(d.width) + cx;
  return (
    (cx >= 0 &&
      cy >= 0 &&
      cx < Math.ceil(d.width) &&
      cy < Math.ceil(d.height) &&
      z.cells?.includes(cell)) ||
    z.rects?.some(
      (r) => x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height,
    )
  );
}
export function visibilityAt(d, state, x, y) {
  if (!state?.fog) return "visible";
  const levels = ["hidden", "explored", "visible"];
  const zones = d.zones.filter((z) => zoneContains(d, z, x, y));
  return zones.length
    ? levels[
        Math.max(
          ...zones.map((z) => Math.max(0, levels.indexOf(state.zones[z.id]))),
        )
      ]
    : state.defaultVisibility;
}
export function rectangle(d, a, b, snapToGrid = true) {
  let x = Math.max(0, Math.min(a.x, b.x)),
    y = Math.max(0, Math.min(a.y, b.y));
  let right = Math.min(d.width, Math.max(a.x, b.x)),
    bottom = Math.min(d.height, Math.max(a.y, b.y));
  if (snapToGrid) {
    x = Math.max(0, Math.floor(x));
    y = Math.max(0, Math.floor(y));
    right = Math.min(d.width, Math.floor(right) + 1);
    bottom = Math.min(d.height, Math.floor(bottom) + 1);
  }
  return {
    x,
    y,
    width: Math.max(0.05, right - x),
    height: Math.max(0.05, bottom - y),
  };
}
export const MAX_TILES = 4096;
export function resized(d, width, height) {
  const next = clone(d),
    oldWidth = Math.ceil(d.width);
  next.width = width;
  next.height = height;
  next.tiles = d.tiles.filter((t) => inside(next, t.x, t.y));
  next.objects = d.objects.filter((o) => inside(next, o.x, o.y));
  next.zones = d.zones.map((z) => ({
    ...z,
    cells: (z.cells || [])
      .filter((c) => inside(next, c % oldWidth, Math.floor(c / oldWidth)))
      .map((c) => Math.floor(c / oldWidth) * Math.ceil(width) + (c % oldWidth)),
    rects: (z.rects || [])
      .filter((r) => inside(next, r.x, r.y))
      .map((r) => ({
        ...r,
        width: Math.min(r.width, width - r.x),
        height: Math.min(r.height, height - r.y),
      })),
  }));
  pruneDecals(next);
  return next;
}
