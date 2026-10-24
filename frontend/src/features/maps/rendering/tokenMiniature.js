import { buildModelObject } from "./modelObject";
import { modelVisual } from "./modelVisual";
import { tokenModelId } from "../lib/tokenModels";
import { tokenBaseModel } from "../lib/tokenBases";
import {
  miniatureBodyScale,
  miniatureBaseScale,
} from "@/shared/model3d/miniatureScale";

export function buildTokenMiniature(token, options, fog) {
  const assets = options.assets;
  if (!assets) return null;
  const id = tokenModelId(token, assets.catalogue?.() || []);
  const visual = id && modelVisual(assets, id, options.tier);
  const metadata = id && assets.metadata(id);
  if (!visual || !(metadata?.referenceDiameter > 0)) return null;
  const scale = miniatureBodyScale(token.size, metadata.referenceDiameter);
  const root = buildModelObject(
    {
      id: token.id,
      modelId: id,
      x: 0,
      y: 0,
      elevation: 0,
      scale,
      rotation: 0,
    },
    assets,
    fog,
    options.tier,
  );
  delete root.userData.objectId;
  const base = tokenBaseModel(token, options.state, assets.catalogue?.() || []);
  const baseReady =
    base?.referenceDiameter > 0 && modelVisual(assets, base.id, options.tier);
  root.position.y = -0.05 + (baseReady ? base.surfaceHeight : 0);
  root.userData.tokenBody = true;
  let baseRoot;
  if (baseReady) {
    baseRoot = buildModelObject(
      {
        id: `${token.id}:base`,
        modelId: base.id,
        x: 0,
        y: 0,
        elevation: 0,
        scale: 1,
        rotation: 0,
      },
      assets,
      fog,
      options.tier,
    );
    delete baseRoot.userData.objectId;
    baseRoot.userData.tokenBase = true;
    const baseScale = miniatureBaseScale(token.size, base.referenceDiameter);
    baseRoot.scale.set(baseScale, 1, baseScale);
    baseRoot.position.y = -0.05;
  }
  if (token.hidden)
    for (const part of [root, baseRoot].filter(Boolean))
      part.traverse((node) => {
        for (const material of [node.material].flat().filter(Boolean)) {
          material.transparent = true;
          material.opacity *= 0.4;
        }
      });
  return {
    root,
    base: baseRoot,
    height: metadata.maxHeight * scale + (baseReady ? base.surfaceHeight : 0),
  };
}
