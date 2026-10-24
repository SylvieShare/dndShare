import { buildModelObject } from "./modelObject";
import { modelVisual } from "./modelVisual";
import { tokenModelId } from "../lib/tokenModels";
import { tokenBaseModel } from "../lib/tokenBases";

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
  const base = tokenBaseModel(token, options.state, assets.catalogue?.() || []);
  root.position.y = -0.05 + (base?.surfaceHeight || 0);
  root.userData.tokenBody = true;
  let baseRoot;
  if (base && modelVisual(assets, base.id, options.tier)) {
    baseRoot = buildModelObject(
      { id: `${token.id}:base`, modelId: base.id, x: 0, y: 0,
        elevation: 0, scale: token.size / base.baseSize, rotation: 0 },
      assets, fog, options.tier,
    );
    delete baseRoot.userData.objectId;
    baseRoot.userData.tokenBase = true;
    baseRoot.position.y = -0.05;
  }
  if (token.hidden)
    for (const part of [root, baseRoot].filter(Boolean)) part.traverse((node) => {
      for (const material of [node.material].flat().filter(Boolean)) {
        material.transparent = true;
        material.opacity *= 0.4;
      }
    });
  return { root, base: baseRoot, height: (assets.metadata(id)?.maxHeight || 1) * token.size + (base?.surfaceHeight || 0) };
}
