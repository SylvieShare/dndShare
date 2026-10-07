import { uid } from "./mapModel";
import { surfacePosition, resolvedSurfacePosition } from "./surfacePlacement";
import { structureContext } from "./tileStructure";

export const manualLightCount = (document) =>
  (document.lights || []).filter((l) => !l.builtinKey).length;

export function builtinLightPose(light, document, catalogue, context) {
  if (!light.builtinKey || !light.anchor) return null;
  const { kind, id } = light.anchor;
  const item = (kind === "tile" ? document.tiles : document.objects).find(
    (m) => m.id === id,
  );
  const model = catalogue.find((m) => m.id === item?.modelId);
  const template = model?.behaviour?.defaultLights?.find(
    (l) => l.key === light.builtinKey,
  );
  if (!template) return null;
  const c = context || structureContext(document, catalogue);
  const [x, y, height] = template.position;
  if (kind === "tile") {
    const base = c.placements.get(id)?.elevation || 0;
    const pose = surfacePosition(
      item,
      model,
      {
        x: x + (model.placementOffset?.[0] || 0),
        y: y + (model.placementOffset?.[1] || 0),
        elevation: model.mountDepth || 0,
      },
      base,
    );
    return { ...light, ...pose, height, worldHeight: base + height };
  }
  const pose = resolvedSurfacePosition(item, document, catalogue, c);
  const a = (item.rotation * Math.PI) / 180,
    scale = item.scale;
  const ox = (x - model.width / 2) * scale,
    oy = (y - model.height / 2) * scale;
  return {
    ...light,
    x: pose.x + ox * Math.cos(a) - oy * Math.sin(a),
    y: pose.y + ox * Math.sin(a) + oy * Math.cos(a),
    elevation: pose.elevation,
    height: height * scale,
    worldHeight: pose.elevation + height * scale,
  };
}

export function syncBuiltinLights(document, catalogue) {
  const models = new Map(catalogue.map((m) => [m.id, m]));
  const previous = new Map(
    (document.lights || [])
      .filter((l) => l.builtinKey && l.anchor)
      .map((l) => [`${l.anchor.kind}:${l.anchor.id}:${l.builtinKey}`, l]),
  );
  const result = (document.lights || []).filter((l) => !l.builtinKey);
  for (const kind of ["tile", "object"]) {
    for (const item of kind === "tile" ? document.tiles : document.objects) {
      const model = models.get(item.modelId);
      for (const template of model?.behaviour?.defaultLights || []) {
        const old = previous.get(`${kind}:${item.id}:${template.key}`);
        result.push({
          id: old?.id || uid(),
          builtinKey: template.key,
          name: template.name,
          kind: template.kind,
          color: template.color,
          x: old?.x || 0,
          y: old?.y || 0,
          elevation: old?.elevation || 0,
          height: template.position[2],
          intensity: template.intensity,
          radius: template.radius,
          enabled: old?.enabled ?? template.enabled,
          flicker: template.flicker,
          showMarker: false,
          shadows: false,
          offset: [0, 0],
          anchor: { kind, id: item.id },
        });
      }
    }
  }
  document.lights = result;
}
