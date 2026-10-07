import { Matrix4, Vector3 } from "three";
import { tileTransform } from "./tileTransform";

// Resolve an anchor in its original frame once, then follow its animated frame.
// This includes the preview lift, turning, upper floors and landing animation.
export function createAttachedLights() {
  let bindings = new Map();
  const position = new Vector3();
  return {
    update(lights, tiles, objects, catalogue) {
      const models = new Map(catalogue.map((m) => [m.id, m]));
      bindings = new Map();
      for (const light of lights) {
        const anchor = light.anchor;
        if (!anchor) continue;
        const item = (anchor.kind === "tile" ? tiles : objects).find(
          (i) => i.id === anchor.id,
        );
        if (!item) continue;
        const model = models.get(item.modelId);
        const frame =
          anchor.kind === "tile" && model
            ? tileTransform(item, model)
            : new Matrix4()
                .makeRotationY((-(item.rotation || 0) * Math.PI) / 180)
                .scale(new Vector3().setScalar(item.scale || 1))
                .setPosition(item.x, item.elevation || 0, item.y);
        bindings.set(light.id, {
          anchor,
          local: new Vector3(light.x, light.worldHeight, light.y).applyMatrix4(
            frame.invert(),
          ),
        });
      }
    },
    position(light, tileMatrix, objectRoots, objectPreview) {
      const binding = bindings.get(light.id);
      if (!binding) return null;
      const { anchor, local } = binding;
      let matrix;
      if (anchor.kind === "tile") matrix = tileMatrix(anchor.id);
      else {
        const visual = [
          ...objectRoots.children,
          ...(objectPreview?.children || []),
        ].find((o) => o.userData.objectId === anchor.id);
        visual?.updateMatrix();
        matrix = visual?.matrix;
      }
      return matrix ? position.copy(local).applyMatrix4(matrix) : null;
    },
  };
}
