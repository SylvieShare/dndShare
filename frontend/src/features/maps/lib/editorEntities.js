import { lightArea, lightPose } from "./mapLighting";
import { structureContext } from "./tileStructure";
import { resolvedSurfacePosition } from "./surfacePlacement";
import { tileSize } from "./tilePlacement";
import { OBJECTS } from "./mapModel";

export function mapEntity(document, catalogue, kind, id, context) {
  const list =
    kind === "tile"
      ? document.tiles
      : kind === "object"
        ? document.objects
        : document.lights;
  const item = list.find((entry) => entry.id === id);
  if (!item) return null;
  if (kind === "light") {
    const pose = lightPose(item, document, catalogue, context);
    return {
      kind,
      id,
      item,
      name: item.name,
      color: item.color,
      enabled: item.enabled,
      areaName: document.areas.find((a) => a.id === lightArea(item, document))
        ?.name,
      position: { x: pose.x, y: pose.y, elevation: pose.worldHeight },
      groupKey: `light:${item.kind}:${item.color}`,
    };
  }
  const model = catalogue.find((m) => m.id === item.modelId),
    c = context || structureContext(document, catalogue),
    position =
      kind === "object"
        ? resolvedSurfacePosition(item, document, catalogue, c)
        : {
            x: item.x,
            y: item.y,
            elevation: c.placements.get(id)?.elevation || 0,
          };
  const size = kind === "tile" && model ? tileSize(item, model) : null;
  return {
    focusPosition: size
      ? { x: position.x + size.width / 2, y: position.y + size.height / 2 }
      : position,
    kind,
    id,
    item,
    model,
    name:
      model?.name ||
      OBJECTS.find((t) => t.id === item.kind)?.name ||
      (kind === "object" ? "Объект" : "Плитка"),
    code: model?.definitionId,
    groupCode: model?.code,
    sourceName: model?.sourceName,
    previewUrl: model?.previewUrl,
    position,
    groupKey: `${kind}:${item.modelId || item.kind}`,
  };
}
export function selectedMapEntities(editor) {
  const d = editor.draft.document,
    c = structureContext(d, editor.catalogue);
  return [
    ...editor.selectedTiles.map((id) =>
      mapEntity(d, editor.catalogue, "tile", id, c),
    ),
    ...editor.selectedObjects.map((id) =>
      mapEntity(d, editor.catalogue, "object", id, c),
    ),
    ...(editor.selectedLight
      ? [mapEntity(d, editor.catalogue, "light", editor.selectedLight, c)]
      : []),
  ].filter(Boolean);
}
export function groupMapEntities(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.groupKey))
      groups.set(entry.groupKey, { ...entry, members: [], count: 0 });
    const group = groups.get(entry.groupKey);
    group.members.push(entry);
    group.count++;
  }
  return [...groups.values()];
}
