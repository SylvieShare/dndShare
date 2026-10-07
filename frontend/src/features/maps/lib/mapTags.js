export const MAX_MAP_TAGS = 32;
export function normalizedMapTags(values) {
  const result = [],
    seen = new Set();
  for (const raw of values) {
    const tag = raw.trim().replace(/\s+/gu, " "),
      key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    if ([...tag].length > 64) throw new Error("Тег: не более 64 символов");
    result.push(tag);
    seen.add(key);
  }
  if (result.length > MAX_MAP_TAGS)
    throw new Error("У карты может быть до 32 тегов");
  return result;
}
export function availableMapTags(maps) {
  return normalizedMapTagsUnlimited(maps.flatMap((m) => m.document.tags));
}
function normalizedMapTagsUnlimited(values) {
  const tags = new Map();
  for (const tag of values)
    if (!tags.has(tag.toLocaleLowerCase()))
      tags.set(tag.toLocaleLowerCase(), tag);
  return [...tags.values()].sort((a, b) => a.localeCompare(b, "ru"));
}
export function matchesMapTags(map, query, selected) {
  const tags = new Set(map.document.tags.map((tag) => tag.toLocaleLowerCase()));
  const needle = query.trim().toLocaleLowerCase();
  return (
    selected.every((tag) => tags.has(tag.toLocaleLowerCase())) &&
    (!needle ||
      map.name.toLocaleLowerCase().includes(needle) ||
      [...tags].some((tag) => tag.includes(needle)))
  );
}
