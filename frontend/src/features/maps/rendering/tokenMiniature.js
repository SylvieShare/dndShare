import { buildModelObject } from "./modelObject";
import { modelVisual } from "./modelVisual";
import { tokenModelId } from "../lib/tokenModels";

export function buildTokenMiniature(token, options, fog) {
  const assets = options.assets;
  if (!assets) return null;
  const id = tokenModelId(token, assets.catalogue?.() || []);
  if (!id || !modelVisual(assets, id, options.tier)) return null;
  const root = buildModelObject(
    {
      id: token.id,
      modelId: id,
      x: 0,
      y: 0,
      elevation: 0,
      scale: token.size,
      rotation: 0,
    },
    assets,
    fog,
    options.tier,
  );
  delete root.userData.objectId;
  root.position.y = -0.05;
  if (token.hidden)
    root.traverse((node) => {
      for (const material of [node.material].flat().filter(Boolean)) {
        material.transparent = true;
        material.opacity *= 0.4;
      }
    });
  return { root, height: (assets.metadata(id)?.maxHeight || 1) * token.size };
}
