import { Box3, Vector3 } from "three";
import { sceneBounds } from "./sceneBounds";

const bounds = new Box3(),
  point = new Vector3();
export function outlineRegion(scene, camera, width, height, ratio) {
  sceneBounds(scene, bounds);
  if (bounds.isEmpty()) return null;
  let left = Infinity,
    right = -Infinity,
    bottom = Infinity,
    top = -Infinity;
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        point.set(x, y, z).project(camera);
        left = Math.min(left, ((point.x + 1) * width) / 2);
        right = Math.max(right, ((point.x + 1) * width) / 2);
        bottom = Math.min(bottom, ((point.y + 1) * height) / 2);
        top = Math.max(top, ((point.y + 1) * height) / 2);
      }
  const pad = Math.ceil(4 * ratio) + 2;
  const x = Math.max(0, Math.floor(left - pad)),
    y = Math.max(0, Math.floor(bottom - pad));
  const w = Math.min(width, Math.ceil(right + pad)) - x;
  const h = Math.min(height, Math.ceil(top + pad)) - y;
  return w > 0 && h > 0 ? { x, y, width: w, height: h } : null;
}
