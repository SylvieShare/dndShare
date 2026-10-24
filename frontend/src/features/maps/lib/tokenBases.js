import { tokenModelId } from './tokenModels';

export function fittingTokenBases(token, catalogue = []) {
  if (token.kind !== 'creature') return [];
  return catalogue.filter(model => model.category === 'creature-base' &&
    model.tileType === 'object' && model.baseSize === token.size);
}

export function chooseTokenBase(token, catalogue, random = Math.random) {
  const choices = fittingTokenBases(token, catalogue).sort((a, b) => a.id.localeCompare(b.id));
  if (choices.some(model => model.id === token.baseModelId)) return token.baseModelId;
  return choices.length ? choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))].id : '';
}

export function tokenBaseModel(token, state, catalogue = []) {
  if (!state?.useCreatureBases || !tokenModelId(token, catalogue)) return null;
  return fittingTokenBases(token, catalogue).find(model => model.id === token.baseModelId) || null;
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
  if (!modelId) return [];
  const base = tokenBaseModel(token, state, catalogue);
  return [
    { ...token, modelId, scale: token.size, tokenSize: token.size, tokenId: token.id, tokenPart: 'body', elevation: (token.elevation || 0) + (base?.surfaceHeight || 0) },
    ...(base ? [{ ...token, id: `${token.id}:base`, modelId: base.id, scale: token.size / base.baseSize, tokenSize: token.size, tokenId: token.id, tokenPart: 'base' }] : []),
  ];
}
