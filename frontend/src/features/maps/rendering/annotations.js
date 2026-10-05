import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
} from "three";

export const FLOOR = 0.44;
function lines(points, colour, opacity = 1, grid = false) {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(points, 3));
  const material = new LineBasicMaterial({
    color: colour,
    transparent: true,
    opacity,
    depthTest: grid,
    depthWrite: false,
  });
  const line = new LineSegments(g, material);
  line.renderOrder = grid ? -1 : 10;
  return line;
}
function rect(points, x, y, w, h, z = FLOOR + 0.01) {
  points.push(
    x,
    z,
    y,
    x + w,
    z,
    y,
    x + w,
    z,
    y,
    x + w,
    z,
    y + h,
    x + w,
    z,
    y + h,
    x,
    z,
    y + h,
    x,
    z,
    y + h,
    x,
    z,
    y,
  );
}
export function buildAnnotations(d, options) {
  const group = new Group();
  if (d.grid.visible && d.kind !== "image") {
    const p = [];
    const elevation = d.kind === "tiles" ? -0.003 : FLOOR;
    for (let x = d.grid.offsetX; x <= d.width; x++)
      if (x >= 0) p.push(x, elevation, 0, x, elevation, d.height);
    for (let y = d.grid.offsetY; y <= d.height; y++)
      if (y >= 0) p.push(0, elevation, y, d.width, elevation, y);
    group.add(lines(p, 0xc8b695, 0.25, true));
  }
  if (options.master && options.showZones)
    for (const zone of d.zones) {
      const p = [];
      for (const r of zone.rects) rect(p, r.x, r.y, r.width, r.height);
      for (const cell of zone.cells)
        rect(
          p,
          (cell % Math.ceil(d.width)) + d.grid.offsetX,
          Math.floor(cell / Math.ceil(d.width)) + d.grid.offsetY,
          1,
          1,
        );
      group.add(
        lines(p, zone.id === options.selectedZone ? 0xc1adf1 : 0x7998ab, 0.7),
      );
    }
  if (options.selection) {
    const p = [],
      r = options.selection;
    rect(p, r.x, r.y, r.width, r.height);
    group.add(lines(p, 0xc1adf1));
  }
  return group;
}
export function disposeAnnotations(root) {
  root.traverse((n) => {
    n.geometry?.dispose();
    n.material?.dispose();
  });
}
