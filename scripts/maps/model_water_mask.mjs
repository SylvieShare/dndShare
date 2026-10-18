import { structureDomain } from "./medieval_structure_domains.mjs";

// Native source comparison preserves stone inside the same atlas and primitive.
// Channel R is water coverage; G selects downward flow instead of bowl ripples.
export function addModelWaterMask(document, settings, nativeZShiftMM = 0) {
  const parts = (settings.surfaceParts || []).filter(
    (p) => p.kind === "liquid",
  );
  if (!parts.length) throw Error("Measured liquid domains required");
  let waterVertices = 0,
    flowVertices = 0;
  for (const node of document.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    const matrix = node.getWorldMatrix();
    for (const primitive of node.getMesh().listPrimitives()) {
      const position = primitive.getAttribute("POSITION"),
        array = new Uint8Array(position.getCount() * 2);
      for (let i = 0; i < position.getCount(); i++) {
        const p = position.getElement(i, []),
          world = [0, 1, 2].map(
            (a) =>
              matrix[a] * p[0] +
              matrix[a + 4] * p[1] +
              matrix[a + 8] * p[2] +
              matrix[a + 12],
          ),
          native = [
            world[0] * 35,
            -world[2] * 35,
            world[1] * 35 + nativeZShiftMM,
          ],
          part = parts.find((part) => structureDomain(native, part));
        if (!part) continue;
        array[i * 2] = 255;
        waterVertices++;
        if (part.flowBelowMM !== undefined) {
          let t = Math.max(
            0,
            Math.min(
              1,
              (part.flowBelowMM - native[2]) / (part.flowBlendMM || 2),
            ),
          );
          t = t * t * (3 - 2 * t);
          array[i * 2 + 1] = Math.round(t * 255);
          if (t > 0.5) flowVertices++;
        }
      }
      const attribute = document
        .createAccessor("Measured water mask")
        .setType("VEC2")
        .setArray(array)
        .setNormalized(true)
        .setBuffer(position.getBuffer());
      primitive.setAttribute("_WATER", attribute);
    }
  }
  if (!waterVertices) throw Error("No measured water found");
  return { waterVertices, flowVertices };
}
