import { modelConnections } from "./tileConnections";
export { TILE_TYPES } from "./tileCategories";
export { WALL_MODES } from "./wallModes";
export const TEXTURE_DETAILS = [
  { value: "basic", label: "Поверхностная" },
  { value: "detailed", label: "Детальная" },
];
export const METADATA_KEYS = [
  "id",
  "definitionId",
  "code",
  "variantCode",
  "collection",
  "collectionName",
  "sourceCode",
  "sourceName",
  "name",
  "nameEn",
  "groupName",
  "groupNameEn",
  "category",
  "textureDetail",
  "tileType",
  "hasDecor",
  "canStand",
  "hidden",
  "placementPoints",
  "wallMode",
  "wallMask",
  "width",
  "height",
  "placementOffset",
  "mountDepth",
  "mountProfile",
  "surfaceHeight",
  "maxHeight",
  "baseSize",
  "referenceDiameter",
  "blockers",
  "tags",
  "supportSlots",
];
export function modelMetadata(model) {
  const result = Object.fromEntries(
    METADATA_KEYS.map((key) => [key, model[key]]),
  );
  result.variantCode ??= "";
  result.wallMask ??= modelConnections(model);
  result.mountDepth ??= 0;
  result.mountProfile ??= "";
  result.placementOffset ||= [0, 0];
  result.supportSlots ||= [];
  result.blockers ||= [];
  result.tags ||= [];
  result.placementPoints ||= [];
  result.hasDecor ??= false;
  result.canStand ??= false;
  result.hidden ??= false;
  return JSON.parse(JSON.stringify(result));
}
