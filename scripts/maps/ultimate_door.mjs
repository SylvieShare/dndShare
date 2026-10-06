import { doorPartAt, paintDoorMaterial } from "./ud010_material.mjs";
export function doorBarPartAt(x, y, z) {
  const original = doorPartAt(x, y, z);
  if (original === "stone") return original;
  const dy = Math.max(0, Math.abs(y) - 6.2),
    dz = Math.max(0, Math.abs(z - 49.25) - 5.1);
  return dy * dy + dz * dz < 1.2 ** 2 ? "iron" : original;
}
export function paintDoorBar(rgb, p, n) {
  return paintDoorMaterial(rgb, p, n, doorBarPartAt(...p));
}
