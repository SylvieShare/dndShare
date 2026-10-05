import {
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  SphereGeometry,
} from "three";
import { tileSize } from "../lib/tilePlacement";
export function createPlacementAnchors() {
  const root = new Group(),
    geometry = new SphereGeometry(0.055, 8, 6),
    matrix = new Matrix4();
  const materials = {
    gray: new MeshBasicMaterial({
      color: 0x8c939d,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    }),
    green: new MeshBasicMaterial({
      color: 0x73c99a,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
    purple: new MeshBasicMaterial({
      color: 0xb399e5,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  };
  let key = "";
  function clear() {
    root.children.forEach((n) => n.dispose());
    root.clear();
  }
  function update(document, context, options) {
    root.visible = !!options.showAnchors && document.kind === "tiles";
    if (!root.visible) return;
    const ignored = new Set(options.previewTile?.tileIds || []),
      active = new Set(),
      near = new Set();
    for (const tile of options.previewTile?.group ||
      (options.previewTile ? [options.previewTile] : [])) {
      const size = tileSize(tile, context.models.get(tile.modelId));
      for (let y = tile.y; y < tile.y + size.height; y++)
        for (let x = tile.x; x < tile.x + size.width; x++)
          active.add(`${x},${y},${tile.level}`);
    }
    for (const [cell, id] of context.occupied) {
      if (ignored.has(id)) continue;
      const [x, y, level] = cell.split(",").map(Number);
      if (level) continue;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) near.add(`${x + dx},${y + dy}`);
    }
    const groups = { gray: [], green: [], purple: [] };
    for (let y = 0; y < document.height; y++)
      for (let x = 0; x < document.width; x++) {
        const cell = `${x},${y},0`,
          occupant = context.occupied.get(cell);
        if (occupant && !ignored.has(occupant)) continue;
        const colour = active.has(cell)
          ? "purple"
          : near.has(`${x},${y}`)
            ? "green"
            : "gray";
        groups[colour].push({ x: x + 0.5, y: y + 0.5, level: 0, elevation: 0 });
      }
    for (const [cell, slot] of context.sockets) {
      const occupant = context.occupied.get(cell);
      if (ignored.has(slot.parent) || (occupant && !ignored.has(occupant)))
        continue;
      const [x, y, level] = cell.split(",").map(Number);
      if (level > 15) continue;
      groups[active.has(cell) ? "purple" : "green"].push({
        x: x + 0.5,
        y: y + 0.5,
        level,
        elevation: slot.elevation,
      });
    }
    const next = JSON.stringify(groups);
    if (next === key) return;
    key = next;
    clear();
    for (const [colour, points] of Object.entries(groups)) {
      if (!points.length) continue;
      const mesh = new InstancedMesh(
        geometry,
        materials[colour],
        points.length,
      );
      mesh.userData.points = points;
      points.forEach((p, i) => {
        matrix.makeTranslation(p.x, p.elevation + 0.03, p.y);
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      root.add(mesh);
    }
    root.updateMatrixWorld(true);
  }
  function hit(ray) {
    if (!root.visible) return null;
    const hit = ray.intersectObjects(root.children, false)[0];
    if (!hit) return null;
    return {
      anchor: hit.object.userData.points[hit.instanceId],
      distance: hit.distance,
    };
  }
  return {
    root,
    update,
    hit,
    destroy: () => {
      clear();
      geometry.dispose();
      Object.values(materials).forEach((m) => m.dispose());
    },
  };
}
