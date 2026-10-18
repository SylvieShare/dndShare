// Remove only the measured sculptural fire; retain all surviving vertex data.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { structureDomain } from "./medieval_structure_domains.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function materialImages(document) {
  return document
    .getRoot()
    .listMaterials()
    .map((m) =>
      Object.fromEntries(
        ["BaseColor", "Normal", "MetallicRoughness", "Occlusion"].map(
          (slot) => [
            slot,
            m[`get${slot}Texture`]?.()?.getImage()
              ? hash(m[`get${slot}Texture`]().getImage())
              : null,
          ],
        ),
      ),
    );
}

export function triangleFingerprint(document, exclude = []) {
  const digest = createHash("sha256");
  for (const node of document.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    digest.update(
      JSON.stringify(node.getWorldMatrix().map((v) => Number(v.toFixed(12)))),
    );
    for (const primitive of node.getMesh().listPrimitives()) {
      const semantics = primitive
          .listSemantics()
          .filter((s) => !exclude.includes(s))
          .sort(),
        positions = primitive.getAttribute("POSITION"),
        indices = primitive.getIndices();
      const vertices = Array.from({ length: positions.getCount() }, (_, i) => {
        const values = semantics.flatMap((s) =>
          primitive.getAttribute(s).getElement(i, []),
        );
        return hash(Buffer.from(JSON.stringify(values)));
      });
      const triangles = [];
      for (let i = 0; i < indices.getCount(); i += 3) {
        const v = [0, 1, 2].map((j) => vertices[indices.getScalar(i + j)]);
        // Meshopt may cyclically rotate a triangle; winding and attributes stay exact.
        triangles.push(
          [
            v.join(""),
            [v[1], v[2], v[0]].join(""),
            [v[2], v[0], v[1]].join(""),
          ].sort()[0],
        );
      }
      digest.update(semantics.join(","));
      digest.update(triangles.sort().join(""));
    }
  }
  return digest.digest("hex");
}

export function stripSculptedFlames(document, settings, nativeZShiftMM = 0) {
  const parts = (settings.surfaceParts || []).filter((p) => p.kind === "flame");
  if (!parts.length) throw Error("Measured flame domains required");
  if ((settings.surfaceParts || []).some((p) => p.kind === "liquid"))
    throw Error("Other emissive surfaces need a separate review");
  const removedBounds = {
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    },
    counts = [];
  for (const node of document.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    const matrix = node.getWorldMatrix();
    for (const primitive of node.getMesh().listPrimitives()) {
      const positions = primitive.getAttribute("POSITION"),
        indices = primitive.getIndices();
      if (!indices || primitive.getMode() !== 4)
        throw Error("Indexed triangle primitives required");
      const native = Array.from({ length: positions.getCount() }, (_, i) => {
        const p = positions.getElement(i, []),
          world = [0, 1, 2].map(
            (a) =>
              matrix[a] * p[0] +
              matrix[a + 4] * p[1] +
              matrix[a + 8] * p[2] +
              matrix[a + 12],
          );
        return [world[0] * 35, -world[2] * 35, world[1] * 35 + nativeZShiftMM];
      });
      const keep = [];
      let removed = 0;
      for (let i = 0; i < indices.getCount(); i += 3) {
        const ids = [0, 1, 2].map((j) => indices.getScalar(i + j)),
          center = [0, 1, 2].map((a) =>
            ids.reduce((s, id) => s + native[id][a] / 3, 0),
          );
        if (
          parts.some(
            (part) =>
              structureDomain(center, part) ||
              ids.some((id) => structureDomain(native[id], part)),
          )
        ) {
          removed++;
          for (const id of ids)
            for (let a = 0; a < 3; a++) {
              removedBounds.min[a] = Math.min(
                removedBounds.min[a],
                native[id][a],
              );
              removedBounds.max[a] = Math.max(
                removedBounds.max[a],
                native[id][a],
              );
            }
        } else keep.push(...ids);
      }
      const oldTriangles = indices.getCount() / 3;
      if (removed) {
        const mapping = new Map(),
          order = [];
        const next = keep.map((id) => {
          if (!mapping.has(id)) {
            mapping.set(id, order.length);
            order.push(id);
          }
          return mapping.get(id);
        });
        for (const semantic of primitive.listSemantics()) {
          const old = primitive.getAttribute(semantic),
            size = old.getElementSize(),
            array = old.getArray(),
            compacted = new array.constructor(order.length * size);
          order.forEach((id, i) =>
            compacted.set(array.subarray(id * size, (id + 1) * size), i * size),
          );
          primitive.setAttribute(semantic, old.clone().setArray(compacted));
        }
        primitive.setIndices(indices.clone().setArray(new Uint32Array(next)));
      }
      counts.push({
        node: node.getName(),
        before: oldTriangles,
        removed,
        after: oldTriangles - removed,
      });
    }
  }
  assert.ok(
    counts.reduce((n, p) => n + p.removed, 0) > 0,
    "No sculptural fire found",
  );
  for (const material of document.getRoot().listMaterials()) {
    material.setEmissiveTexture(null).setEmissiveFactor([0, 0, 0]);
    const strength = material.getExtension("KHR_materials_emissive_strength");
    if (strength)
      material.setExtension("KHR_materials_emissive_strength", null);
  }
  return { counts, removedBounds };
}
