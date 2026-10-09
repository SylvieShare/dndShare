import { interactive } from "./mapModel";
import { resolvedSurfacePosition } from "./surfacePlacement";
import { structureContext } from "./tileStructure";
// Scene edits and play state are saved together. Remove links to deleted entities.
export function normalizeSessionMap(map, catalogue) {
  const d = map.document,
    s = map.state;
  const tiles = new Set(d.tiles.map((t) => t.id)),
    objects = new Set(
      d.objects.filter((o) => interactive(o.kind)).map((o) => o.id),
    ),
    zones = new Set((d.zones || []).map((z) => z.id));
  s.objects = Object.fromEntries(
    Object.entries(s.objects || {}).filter(([id]) => objects.has(id)),
  );
  s.zones = Object.fromEntries(
    Object.entries(s.zones || {}).filter(([id]) => zones.has(id)),
  );
  s.tokens = (s.tokens || []).filter(
    (t) => !t.placement || tiles.has(t.placement.tileId),
  );
  const context = structureContext(d, catalogue);
  for (const token of s.tokens) {
    if (token.placement) {
      const posed = resolvedSurfacePosition(token, d, catalogue, context);
      token.x = posed.x;
      token.y = posed.y;
    }
    token.x = Math.max(0, Math.min(d.width, token.x));
    token.y = Math.max(0, Math.min(d.height, token.y));
  }
}
