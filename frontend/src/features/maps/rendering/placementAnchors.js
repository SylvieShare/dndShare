import {
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  SphereGeometry,
} from "three";
import { tileSize } from "../lib/tilePlacement";
import { TILE_ACCENT } from "./mapAccents";
export function createPlacementAnchors() {
  const root = new Group(),
    geometry = new SphereGeometry(0.055, 8, 6),
    matrix = new Matrix4();
  const materials = {
    green: new MeshBasicMaterial({
      color: TILE_ACCENT,
      toneMapped: false,
    }),
    purple: new MeshBasicMaterial({
      color: TILE_ACCENT,
      toneMapped: false,
    }),
  };
  let key = "";
  function clear() {
    root.children.forEach((n) => n.dispose());
    root.clear();
  }
  function update(document, context, options) {
    root.visible = !!options.showAnchors;
    if (!root.visible) return;
    const ignored = new Set(options.previewTile?.tileIds || []),
      active = new Set();
    for (const tile of options.previewTile?.group ||
      (options.previewTile ? [options.previewTile] : [])) {
      const size = tileSize(tile, context.models.get(tile.modelId));
      for (let y = tile.y; y < tile.y + size.height; y++)
        for (let x = tile.x; x < tile.x + size.width; x++)
          active.add(`${x},${y},${tile.level}`);
    }
    const groups = { green: [], purple: [] };
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
        matrix.makeScale(...Array(3).fill(colour === "purple" ? 1.4 : 1));
        matrix.setPosition(p.x, p.elevation + 0.03, p.y);
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
