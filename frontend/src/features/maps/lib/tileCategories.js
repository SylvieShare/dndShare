export const TILE_CATEGORIES = [
  { value: "floor", label: "Пол", tileType: "floor" },
  { value: "wall", label: "Все стены", tileType: "wall" },
  {
    value: "wall-straight",
    label: "Прямые стены",
    tileType: "wall",
    layout: "straight",
  },
  {
    value: "wall-angle",
    label: "Углы стен",
    tileType: "wall",
    layout: "angle",
  },
  {
    value: "wall-tee",
    label: "Т-образные стены",
    tileType: "wall",
    layout: "tee",
  },
  {
    value: "wall-cross",
    label: "Х-образные стены",
    tileType: "wall",
    layout: "cross",
  },
  {
    value: "wall-corner",
    label: "Выступы и окончания стен",
    tileType: "wall",
    layout: "corner",
  },
  {
    value: "wall-custom",
    label: "Сложные стены",
    tileType: "wall",
    layout: "custom",
  },
  { value: "stairs", label: "Лестницы", tileType: "stairs" },
  { value: "frame", label: "Каркасы", tileType: "frame" },
  { value: "prop", label: "Декор", tileType: "prop" },
];
export function matchesTileCategory(model, value) {
  const category = TILE_CATEGORIES.find((c) => c.value === value);
  if (!category) return false;
  if (category.tileType && model.tileType !== category.tileType) return false;
  if (category.layout === "custom")
    return !["none", "straight", "angle", "tee", "cross", "corner"].includes(
      model.wallLayout,
    );
  return !category.layout || model.wallLayout === category.layout;
}
