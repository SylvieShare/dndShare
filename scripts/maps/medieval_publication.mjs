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
  // Logical cell curation leaves the measured physical contact unchanged.
  physical.placementPoints = physical.placementPoints?.map(({ cell, ...point }) => point);
  return physical;
}

function validCells(model) {
  return (model?.placementPoints || []).every(({ cell }) => cell === undefined || (
    Number.isInteger(cell?.x) && Number.isInteger(cell?.y) &&
    cell.x >= 0 && cell.y >= 0 && cell.x < model.width && cell.y < model.height
  ));
}

// Catalogue and logical-cell curation do not undo completed painting. Everything else,
// including UUID, source identity, all assets and placement, must still match.
export function matchesPreparedPublication(prepared, current) {
  return Boolean(
    prepared &&
    current &&
    validCells(current) &&
    isDeepStrictEqual(
      physicalPublication(prepared),
      physicalPublication(current),
    ),
  );
}
