import { fogAreaMembers } from "./mapAreas";
import { structureContext } from "./tileStructure";
import { tileSize } from "./tilePlacement";
import { resolvedSurfacePosition } from "./surfacePlacement";
import { builtinLightPose, syncBuiltinLights } from "./builtinLights";
import { documentIndex } from "./documentIndex";
export const LIGHT_PRESETS = [
  {
    kind: "torch",
    name: "Факел",
    color: "#ffc36a",
    intensity: 8,
    radius: 4.5,
    height: 0.9,
    flicker: true,
  },
  {
    kind: "candle",
    name: "Свеча",
    color: "#ffd899",
    intensity: 3,
    radius: 2.5,
    height: 0.4,
    flicker: true,
  },
  {
    kind: "magic",
    name: "Магический свет",
    color: "#a98aff",
    intensity: 10,
    radius: 5.5,
    height: 1,
    flicker: false,
  },
];
export const DEFAULT_SUN = { enabled: true, angle: 225, elevation: 45 };
export function lightPose(light, document, catalogue, context) {
  const builtin = builtinLightPose(light, document, catalogue, context);
  if (builtin) return builtin;
  let x = light.x,
    y = light.y,
    elevation = light.elevation || 0,
    angle = 0;
  const anchor = light.anchor;
  if (anchor?.kind === "tile") {
    const tile =
        context?.tilesById?.get(anchor.id) ||
        document.tiles.find((t) => t.id === anchor.id),
      model =
        context?.models?.get(tile?.modelId) ||
        catalogue.find((m) => m.id === tile?.modelId);
    if (tile && model) {
      const size = tileSize(tile, model),
        c = context || structureContext(document, catalogue);
      x = tile.x + size.width / 2;
      y = tile.y + size.height / 2;
      angle = tile.rotation;
      elevation =
        (c.placements.get(tile.id)?.elevation || 0) +
        model.surfaceHeight -
        (model.mountDepth || 0);
    }
  } else if (anchor?.kind === "object") {
    const object =
      context?.objectsById?.get(anchor.id) ||
      document.objects.find((o) => o.id === anchor.id);
    if (object) {
      const posed = resolvedSurfacePosition(
          object,
          document,
          catalogue,
          context,
        ),
        model =
          context?.models?.get(object.modelId) ||
          catalogue.find((m) => m.id === object.modelId);
      x = posed.x;
      y = posed.y;
      angle = object.rotation;
      elevation = posed.elevation + (model?.maxHeight || 0.6) * object.scale;
    }
  }
  const a = (angle * Math.PI) / 180,
    [ox, oy] = light.offset || [0, 0];
  if (anchor) {
    x += ox * Math.cos(a) - oy * Math.sin(a);
    y += ox * Math.sin(a) + oy * Math.cos(a);
  }
  return { ...light, x, y, elevation, worldHeight: elevation + light.height };
}
export function lightArea(light, document, context) {
  if (!light.anchor) return light.areaId || "";
  const { kind, id } = light.anchor;
  if (context?.tileAreas) {
    const own = (kind === "tile" ? context.tileAreas : context.objectAreas).get(
      id,
    );
    if (own) return own.id;
    const parent =
      kind === "object" && context.objectsById.get(id)?.placement?.tileId;
    return context.tileAreas.get(parent)?.id || "";
  }
  const own = document.areas?.find((a) =>
    (kind === "tile" ? a.tileIds : a.objectIds).includes(id),
  );
  if (own) return own.id;
  const parent =
    kind === "object" &&
    document.objects?.find((o) => o.id === id)?.placement?.tileId;
  return document.areas?.find((a) => a.tileIds.includes(parent))?.id || "";
}
export function lightOpacity(
  light,
  document,
  mode,
  mist = fogAreaMembers(document),
  context,
) {
  if (
    light.anchor &&
    (light.anchor.kind === "tile" ? mist.tiles : mist.objects).has(
      light.anchor.id,
    )
  )
    return 0;
  const areaId = lightArea(light, document, context);
  const area = context?.areasById
    ? context.areasById.get(areaId)
    : document.areas?.find((a) => a.id === areaId);
  if (area?.fog) return 0;
  return area?.hidden ? (mode === "ghost" ? 0.12 : 0) : 1;
}
export function syncLights(document, catalogue) {
  syncBuiltinLights(document, catalogue);
  const context = documentIndex(
    document,
    catalogue,
    structureContext(document, catalogue),
  ).structure;
  const tiles = new Set(document.tiles.map((t) => t.id)),
    objects = new Set(document.objects.map((o) => o.id)),
    areas = new Set(document.areas?.map((a) => a.id));
  const remaining = (document.lights || []).filter(
    (l) =>
      !l.anchor ||
      (l.anchor.kind === "tile" ? tiles : objects).has(l.anchor.id),
  );
  if (remaining.length !== document.lights?.length) document.lights = remaining;
  for (const light of document.lights) {
    // Match the API's omitted empty areaId instead of dirtying every loaded map.
    if (light.anchor || (light.areaId && !areas.has(light.areaId)))
      delete light.areaId;
    if (light.anchor) {
      const pose = lightPose(light, document, catalogue, context);
      light.x = pose.x;
      light.y = pose.y;
      light.elevation = pose.elevation;
    }
  }
}
