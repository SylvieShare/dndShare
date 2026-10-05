import { modelConnections } from "./tileConnections";
export const TILE_TYPES = [
  { value: "floor", label: "Пол" },
  { value: "wall", label: "Стены" },
  { value: "stairs", label: "Лестницы" },
  { value: "frame", label: "Каркасы" },
  { value: "prop", label: "Декор" },
];
export const WALL_MODES = [
  { value: "none", label: "Без стыков" },
  { value: "center", label: "Центральные стены: точки" },
  { value: "edge", label: "Боковые стены: стороны" },
];
export const TEXTURE_DETAILS = [
  { value: "basic", label: "Поверхностная" },
  { value: "detailed", label: "Детальная" },
];
export const METADATA_KEYS = [
  "id",
  "collection",
  "collectionName",
  "sourceCode",
  "sourceName",
  "name",
  "version",
  "textureDetail",
  "tileType",
  "terrainType",
  "wallLayout",
  "wallMode",
  "wallMask",
  "width",
  "height",
  "placementOffset",
  "mountDepth",
  "surfaceHeight",
  "maxHeight",
  "blockers",
  "tags",
  "supportSlots",
];
export function modelMetadata(model) {
  const result = Object.fromEntries(
    METADATA_KEYS.map((key) => [key, model[key]]),
  );
  result.wallMask ??= modelConnections(model);
  result.mountDepth ??= 0;
  result.placementOffset ||= [0, 0];
  result.supportSlots ||= [];
  result.blockers ||= [];
  result.tags ||= [];
  return JSON.parse(JSON.stringify(result));
}
export function groupedTileModels(models) {
  return TILE_TYPES.map((type) => ({
    ...type,
    models: models.filter((m) => m.tileType === type.value),
  })).filter((g) => g.models.length);
}
