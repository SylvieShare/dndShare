export const DEFAULT_AREA_COLOR = "#8b5cf6";
export function hiddenAreaMembers(document) {
  const tiles = new Set(),
    objects = new Set();
  for (const area of document.areas || [])
    if (area.hidden) {
      area.tileIds.forEach((id) => tiles.add(id));
      area.objectIds.forEach((id) => objects.add(id));
    }
  return { tiles, objects };
}
export function areaAppearance(document, mode = "hide") {
  const members = hiddenAreaMembers(document);
  return {
    hiddenTiles: mode === "hide" ? members.tiles : new Set(),
    hiddenObjects: mode === "hide" ? members.objects : new Set(),
    tileOpacity: (id) => (mode === "ghost" && members.tiles.has(id) ? 0.12 : 1),
    objectOpacity: (id) =>
      mode === "ghost" && members.objects.has(id) ? 0.12 : 1,
  };
}
export function pruneAreas(document) {
  const tiles = new Set(document.tiles.map((t) => t.id)),
    objects = new Set(document.objects.map((o) => o.id));
  for (const area of document.areas || []) {
    area.tileIds = area.tileIds.filter((id) => tiles.has(id));
    area.objectIds = area.objectIds.filter((id) => objects.has(id));
  }
  return document;
}
export function assignArea(document, areaId, members) {
  const target = document.areas.find((a) => a.id === areaId);
  if (!target) return;
  const tiles = new Set(members.tiles),
    objects = new Set(members.objects);
  for (const area of document.areas) {
    area.tileIds = area.tileIds.filter((id) => !tiles.has(id));
    area.objectIds = area.objectIds.filter((id) => !objects.has(id));
  }
  target.tileIds.push(...tiles);
  target.objectIds.push(...objects);
  pruneAreas(document);
}
