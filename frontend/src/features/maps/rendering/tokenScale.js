import { Vector3 } from "three";
export const TOKEN_VISUAL_SCALE = .7;
const radii = new WeakMap();
export function tokenBodyScale(size, model) {
  if (!radii.has(model)) {
    let radius = 0;
    const point = new Vector3();
    for (const part of model.parts) {
      const geometry = part.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      if (!box) continue;
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z]) {
            point.set(x, y, z).applyMatrix4(part.matrix);
            radius = Math.max(radius, Math.hypot(point.x, point.z));
          }
    }
    radii.set(model, radius);
  }
  return size * Math.min(TOKEN_VISUAL_SCALE, .35 / (radii.get(model) || 1));
}
