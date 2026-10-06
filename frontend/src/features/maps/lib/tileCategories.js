export const TILE_TYPES = [
  { value: "floor", label: "Пол" },
  { value: "wall-straight", label: "Прямые стены" },
  { value: "wall-angle", label: "Внутренние углы (Angle)" },
  { value: "wall-tee", label: "Т-образные стены" },
  { value: "wall-cross", label: "Х-образные стены" },
  { value: "wall-corner", label: "Наружные углы (Corner)" },
  { value: "wall-diagonal", label: "Диагональные стены" },
  { value: "wall-end", label: "Выступы и окончания стен" },
  { value: "stairs", label: "Лестницы" },
  { value: "frame", label: "Каркасы" },
  { value: "bridge", label: "Мосты" },
  { value: "passage", label: "Проходы и двери" },
  { value: "column", label: "Колонны" },
];
export const TILE_CATEGORIES = TILE_TYPES;
export function isWallTile(model) {
  return TILE_TYPES.some(
    (t) => t.value.startsWith("wall-") && t.value === model?.tileType,
  );
}
export function matchesTileCategory(model, value) {
  return TILE_TYPES.some((t) => t.value === value) && model.tileType === value;
}
