import { isWallTile } from "./tileCategories";
export const CONNECTIONS = [
  { key: "n", label: "Север", x: 0, y: -1 },
  { key: "ne", label: "Северо-восток", x: 1, y: -1 },
  { key: "e", label: "Восток", x: 1, y: 0 },
  { key: "se", label: "Юго-восток", x: 1, y: 1 },
  { key: "s", label: "Юг", x: 0, y: 1 },
  { key: "sw", label: "Юго-запад", x: -1, y: 1 },
  { key: "w", label: "Запад", x: -1, y: 0 },
  { key: "nw", label: "Северо-запад", x: -1, y: -1 },
];
const masks = new WeakMap();
function contains(polygon, x, y) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i],
      [bx, by] = polygon[j];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
      inside = !inside;
  }
  return inside;
}
export function modelConnections(model) {
  if (Number.isInteger(model?.wallMask)) return model.wallMask;
  if (!isWallTile(model)) return 0;
  if (masks.has(model)) return masks.get(model);
  const fallback = { straight: 17, angle: 65, tee: 21, cross: 85, corner: 1 };
  let mask = 0;
  if (!model.blockers?.length) mask = fallback[model.tileType.slice(5)] || 0;
  else
    CONNECTIONS.forEach(({ x, y }, index) => {
      if (
        model.blockers.some((p) =>
          contains(p, 0.5 + x * 0.485, 0.5 + y * 0.485),
        )
      )
        mask |= 1 << index;
    });
  masks.set(model, mask);
  return mask;
}
export function wallControlMode(model) {
  return model?.wallMode || "center";
}
export function rotateConnections(mask, rotation) {
  const shift = (((rotation / 45) % 8) + 8) % 8;
  return ((mask << shift) | (mask >> (8 - shift))) & 255;
}
export function tileConnections(tile, catalogue) {
  return rotateConnections(
    modelConnections(catalogue.find((m) => m.id === tile.modelId)),
    tile.rotation,
  );
}
function family(model) {
  return (model.sourceName || "")
    .replace(/(?:Wall|Ground|Angle|Corner|Column).*$/, "")
    .trim();
}
export function connectionVariant(tile, mask, catalogue) {
  const current = catalogue.find((m) => m.id === tile.modelId);
  if (!current) return null;
  const candidates = [];
  for (const model of catalogue) {
    if (
      model.collection !== current.collection ||
      wallControlMode(model) !== wallControlMode(current) ||
      (model.tileType !== "floor" && !isWallTile(model))
    )
      continue;
    for (const rotation of [0, 90, 180, 270]) {
      const currentWidth = tile.rotation % 180 ? current.height : current.width,
        currentHeight = tile.rotation % 180 ? current.width : current.height;
      const width = rotation % 180 ? model.height : model.width,
        height = rotation % 180 ? model.width : model.height;
      if (width !== currentWidth || height !== currentHeight) continue;
      if (rotateConnections(modelConnections(model), rotation) !== mask)
        continue;
      const score =
        (model.id === current.id ? 100 : 0) +
        (family(model) === family(current) ? 20 : 0) +
        (rotation === tile.rotation ? 1 : 0);
      candidates.push({
        modelId: model.id,
        rotation,
        score,
        sourceCode: model.sourceCode,
      });
    }
  }
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.sourceCode.localeCompare(b.sourceCode) ||
      a.rotation - b.rotation,
  );
  return candidates[0] || null;
}
