import { isDeepStrictEqual } from "node:util";

function physicalPublication(model) {
  const {
    code,
    variantCode,
    name,
    nameEn,
    groupName,
    groupNameEn,
    category,
    ...physical
  } = model;
  return physical;
}

// Catalogue curation does not undo completed painting. Everything else,
// including UUID, source identity, all assets and placement, must still match.
export function matchesPreparedPublication(prepared, current) {
  return Boolean(
    prepared &&
    current &&
    isDeepStrictEqual(
      physicalPublication(prepared),
      physicalPublication(current),
    ),
  );
}
