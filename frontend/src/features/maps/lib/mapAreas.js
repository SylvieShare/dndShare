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
export function fogAreaMembers(document) {
  const tiles = new Set(),
    objects = new Set();
  for (const area of document.areas || [])
    if (area.fog) {
      area.tileIds.forEach((id) => tiles.add(id));
      area.objectIds.forEach((id) => objects.add(id));
    }
  for (const object of document.objects || [])
    if (tiles.has(object.placement?.tileId)) objects.add(object.id);
  return { tiles, objects };
}
export function areaAppearance(document, mode = "hide", motion) {
  const members = hiddenAreaMembers(document),
    mist = fogAreaMembers(document);
  const tileAreas = new Map(),
    objectAreas = new Map(),
    parents = new Map(
      (document.objects || []).map((o) => [o.id, o.placement?.tileId]),
    );
  for (const area of document.areas || []) {
    for (const id of area.tileIds) tileAreas.set(id, area);
    for (const id of area.objectIds) objectAreas.set(id, area);
  }
  for (const object of document.objects || [])
    if (members.tiles.has(object.placement?.tileId))
      members.objects.add(object.id);
  const visible = (area) =>
    !area ? 1 : motion ? motion.visibility(area.id) : area.hidden ? 0 : 1;
  const opacity = (area) =>
    mode === "ghost" ? 0.12 + 0.88 * visible(area) : visible(area);
  const fog = (area) =>
    !area ? 0 : motion ? motion.fog(area.id) : area.fog ? 1 : 0;
  const flash = (area) => (area && motion ? motion.flash(area.id) : 1);
  const host = (id) => tileAreas.get(parents.get(id));
  const objectFog = (id) => Math.max(fog(objectAreas.get(id)), fog(host(id)));
  const objectOpacity = (id) =>
    Math.min(opacity(objectAreas.get(id)), opacity(host(id))) *
    (1 - objectFog(id));
  return {
    hiddenTiles: mode === "hide" ? members.tiles : new Set(),
    hiddenObjects: new Set([
      ...(mode === "hide" ? members.objects : []),
      ...mist.objects,
    ]),
    foggedTiles: mist.tiles,
    tileGroup: (id) => tileAreas.get(id)?.id || "",
    tileOpacity: (id) => opacity(tileAreas.get(id)),
    tileFlash: (id) => flash(tileAreas.get(id)),
    objectOpacity,
    objectFlash: (id) => Math.max(flash(objectAreas.get(id)), flash(host(id))),
    tokenOpacity: (id) =>
      opacity(tileAreas.get(id)) * (1 - fog(tileAreas.get(id))),
    lightOpacity(light) {
      if (light.anchor?.kind === "tile")
        return (
          opacity(tileAreas.get(light.anchor.id)) *
          (1 - fog(tileAreas.get(light.anchor.id)))
        );
      if (light.anchor?.kind === "object")
        return objectOpacity(light.anchor.id);
      const area = document.areas.find((a) => a.id === light.areaId);
      return opacity(area) * (1 - fog(area));
    },
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
