export const TILE_TYPES = [
  { value: "floor", label: "Пол" },
  { value: "wall-straight", label: "Прямые стены" },
  { value: "wall-angle", label: "Углы стен" },
  { value: "wall-tee", label: "Т-образные стены" },
  { value: "wall-cross", label: "Х-образные стены" },
  { value: "wall-corner", label: "Выступы и окончания стен" },
  { value: "wall-custom", label: "Сложные стены" },
  { value: "stairs", label: "Лестницы" },
  { value: "frame", label: "Каркасы" },
  { value: "prop", label: "Декор" },
];
export const TILE_CATEGORIES = [
  TILE_TYPES[0],
  { value: "wall", label: "Все стены" },
  ...TILE_TYPES.slice(1),
];
export function isWallTile(model) {
  return TILE_TYPES.some(
    (t) => t.value.startsWith("wall-") && t.value === model?.tileType,
  );
}
export function matchesTileCategory(model, value) {
  return value === "wall"
    ? isWallTile(model)
    : TILE_TYPES.some((t) => t.value === value) && model.tileType === value;
}
