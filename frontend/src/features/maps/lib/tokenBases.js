import { tokenModelId } from "./tokenModels";
import {
  miniatureBodyScale,
  miniatureBaseScale,
} from "@/shared/model3d/miniatureScale";

export function fittingTokenBases(token, catalogue = []) {
  if (token.kind !== "creature") return [];
  return catalogue.filter(
    (model) =>
      model.category === "creature-base" &&
      model.tileType === "object" &&
      model.referenceDiameter > 0 &&
      model.baseSize === token.size,
  );
}

export function chooseTokenBase(token, catalogue, random = Math.random) {
  const choices = fittingTokenBases(token, catalogue).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  if (choices.some((model) => model.id === token.baseModelId))
    return token.baseModelId;
  return choices.length
    ? choices[
        Math.min(choices.length - 1, Math.floor(random() * choices.length))
      ].id
    : "";
}

export function tokenBaseModel(token, state, catalogue = []) {
  if (!state?.useCreatureBases || !tokenModelId(token, catalogue)) return null;
  return (
    fittingTokenBases(token, catalogue).find(
      (model) => model.id === token.baseModelId,
    ) || null
  );
}

export function assignTokenBases(state, catalogue, random = Math.random) {
  if (!state.useCreatureBases) return;
  for (const token of state.tokens || []) {
    if (!tokenModelId(token, catalogue)) continue;
    const id = chooseTokenBase(token, catalogue, random);
    if (id) token.baseModelId = id;
    else delete token.baseModelId;
  }
}

// Shared by residency and shadow planning; the visible roots use the same poses.
export function tokenVisualModels(token, state, catalogue = []) {
  const modelId = tokenModelId(token, catalogue);
  const body = catalogue.find((m) => m.id === modelId);
  if (!(body?.referenceDiameter > 0)) return [];
  const base = tokenBaseModel(token, state, catalogue);
  return [
    {
      ...token,
      modelId,
      scale: miniatureBodyScale(token.size, body.referenceDiameter),
      tokenSize: token.size,
      tokenId: token.id,
      tokenPart: "body",
      elevation: (token.elevation || 0) + (base?.surfaceHeight || 0),
    },
    ...(base
      ? [
          {
            ...token,
            id: `${token.id}:base`,
            modelId: base.id,
            scale: miniatureBaseScale(token.size, base.referenceDiameter),
            tokenSize: token.size,
            tokenId: token.id,
            tokenPart: "base",
          },
        ]
      : []),
  ];
}
