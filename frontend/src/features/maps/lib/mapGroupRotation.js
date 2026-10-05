import { tileSize } from "./tilePlacementSize";

export function groupRotationPivot(tiles, objects, catalogue) {
  const models = new Map(catalogue.map((m) => [m.id, m]));
  const bounds = tiles.map((t) => {
    const size = tileSize(t, models.get(t.modelId));
    return [t.x, t.y, t.x + size.width, t.y + size.height];
  });
  bounds.push(...objects.map((o) => [o.x, o.y, o.x, o.y]));
  const center = {
    x:
      (Math.min(...bounds.map((b) => b[0])) +
        Math.max(...bounds.map((b) => b[2]))) /
      2,
    y:
      (Math.min(...bounds.map((b) => b[1])) +
        Math.max(...bounds.map((b) => b[3]))) /
      2,
  };
  if (!tiles.length) return center;
  // A shared grid vertex or cell centre keeps every rotated footprint integral.
  const candidates = [0, 0.5].map((offset) => ({
    x: Math.round(center.x - offset) + offset,
    y: Math.round(center.y - offset) + offset,
  }));
  return candidates.sort(
    (a, b) =>
      Math.hypot(a.x - center.x, a.y - center.y) -
      Math.hypot(b.x - center.x, b.y - center.y),
  )[0];
}

export function rotateMapGroup(tiles, objects, catalogue, pivot) {
  const models = new Map(catalogue.map((m) => [m.id, m]));
  const turn = (x, y) => ({
    x: pivot.x - (y - pivot.y),
    y: pivot.y + (x - pivot.x),
  });
  return {
    tiles: tiles.map((t) => {
      const { width, height } = tileSize(t, models.get(t.modelId));
      const center = turn(t.x + width / 2, t.y + height / 2);
      return {
        ...t,
        x: Math.round(center.x - height / 2),
        y: Math.round(center.y - width / 2),
        rotation: (t.rotation + 90) % 360,
      };
    }),
    objects: objects.map((o) => ({
      ...o,
      ...turn(o.x, o.y),
      rotation: (o.rotation + 90) % 360,
    })),
  };
}
