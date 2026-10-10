import { createRequire } from "node:module";
import { readGlb, replaceImages } from "./glb_textures.mjs";
import { reviewedCaveFootprint } from "./reviewed_cave_footprint.mjs";
import { measurePads, pegPrimitive } from "./peg-geometry.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { Document, NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { dequantize } = require("@gltf-transform/functions");
const { MeshoptDecoder } = require("meshoptimizer");
const isPeg = (material) =>
  material?.getName().startsWith("Simple insertion pegs");

export function fittedPads(pads, bottomWidthMM = 22.75) {
  if (![22.75, 14.8].includes(bottomWidthMM))
    throw new Error("Reviewed insertion bottom width required");
  return pads.map((pad) => {
    const top = { min: [], max: [] },
      bottom = { min: [], max: [] };
    for (let axis = 0; axis < 2; axis++) {
      const width = pad.top.max[axis] - pad.top.min[axis];
      if (width < 0.95 || width > 1.05)
        throw new Error("Inspect a non-cell-sized insertion pad separately");
      const centre = (pad.top.max[axis] + pad.top.min[axis]) / 2;
      top.min[axis] = centre - 0.98 / 2;
      top.max[axis] = centre + 0.98 / 2;
      bottom.min[axis] = centre - bottomWidthMM / 70;
      bottom.max[axis] = centre + bottomWidthMM / 70;
    }
    return { top, bottom };
  });
}

// Append a tiny replacement mesh; original body buffers, atlases and nodes stay intact.
export async function fitCavePegs(bytes, model, sourceFootprint) {
  if (model.collection !== "lost-cave")
    throw new Error("One Lost Cave model required");
  const reviewed = reviewedCaveFootprint(sourceFootprint, model);
  const source = readGlb(Buffer.from(bytes));
  const sourcePegs = source.json.meshes.filter((mesh) =>
    mesh.primitives.some((p) =>
      source.json.materials[p.material]?.name?.startsWith(
        "Simple insertion pegs",
      ),
    ),
  );
  if (
    sourcePegs.length &&
    sourcePegs.every(
      (mesh) =>
        mesh.extras?.dndShareInsertionProfile === "lost-cave-slot-fit-v1" &&
        mesh.extras.mountDepth === model.mountDepth &&
        (!reviewed ||
          mesh.extras.sourceFootprintSignature === reviewed.signature),
    )
  )
    return { bytes, pads: [], unchanged: true };
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const doc = await io.readBinary(bytes);
  await doc.transform(dequantize());
  const parts = [];
  for (const node of doc.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    for (const primitive of node.getMesh().listPrimitives())
      if (isPeg(primitive.getMaterial()))
        parts.push({ primitive, matrix: node.getWorldMatrix() });
  }
  if (!parts.length) return { bytes, pads: [], unchanged: true };
  if (!(model.mountDepth > 0 && model.mountDepth < (reviewed ? 0.32 : 0.25)))
    throw new Error("Reviewed insertion depth required");
  const pads = fittedPads(
    reviewed?.pads ?? measurePads(parts, model.mountDepth),
    sourceFootprint?.bottomWidthMM ?? 22.75,
  );
  const primitive = pegPrimitive(
    new Document(),
    pads,
    model.mountDepth,
    model.collection,
  );
  const positions = primitive.getAttribute("POSITION").getArray();
  const normals = primitive.getAttribute("NORMAL").getArray();
  const glb = source,
    json = glb.json;
  if (json.scenes.length !== 1 || json.animations?.length)
    throw new Error("One static model scene required");
  const removed = new Set();
  let material;
  json.meshes.forEach((mesh, index) => {
    const flags = mesh.primitives.map((p) =>
      json.materials[p.material]?.name?.startsWith("Simple insertion pegs"),
    );
    if (!flags.some(Boolean)) return;
    if (!flags.every(Boolean)) throw new Error("Mount and body share a mesh");
    removed.add(index);
    material ??= mesh.primitives[0].material;
  });
  if (!removed.size) throw new Error("Missing source insertion mesh");
  const remap = new Map();
  json.meshes = json.meshes.filter((_, index) => {
    if (removed.has(index)) return false;
    remap.set(index, remap.size);
    return true;
  });
  for (const node of json.nodes) {
    if (node.mesh === undefined) continue;
    if (removed.has(node.mesh)) delete node.mesh;
    else node.mesh = remap.get(node.mesh);
  }
  function append(values, bounds = false, scalar = false) {
    const offset = Math.ceil(json.buffers[0].byteLength / 4) * 4;
    const payload = Buffer.from(
      values.buffer,
      values.byteOffset,
      values.byteLength,
    );
    const bin = Buffer.alloc(offset + payload.length);
    glb.bin.copy(bin, 0, 0, json.buffers[0].byteLength);
    payload.copy(bin, offset);
    glb.bin = bin;
    json.buffers[0].byteLength = bin.length;
    const bufferView = json.bufferViews.length;
    json.bufferViews.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: payload.length,
      target: scalar ? 34963 : 34962,
    });
    const accessor = json.accessors.length;
    const entry = {
      bufferView,
      componentType: scalar ? 5123 : 5126,
      count: values.length / (scalar ? 1 : 3),
      type: scalar ? "SCALAR" : "VEC3",
    };
    if (bounds) {
      const stride = scalar ? 1 : 3;
      entry.min = Array(stride).fill(Infinity);
      entry.max = Array(stride).fill(-Infinity);
      for (let i = 0; i < values.length; i++) {
        entry.min[i % stride] = Math.min(entry.min[i % stride], values[i]);
        entry.max[i % stride] = Math.max(entry.max[i % stride], values[i]);
      }
    }
    json.accessors.push(entry);
    return accessor;
  }
  const attributes = {
    POSITION: append(positions, true),
    NORMAL: append(normals),
  };
  const indices = append(
    Uint16Array.from({ length: positions.length / 3 }, (_, i) => i),
    true,
    true,
  );
  const mesh = json.meshes.length;
  json.meshes.push({
    name: "Fitted insertion geometry",
    extras: {
      dndShareInsertionProfile: "lost-cave-slot-fit-v1",
      mountDepth: model.mountDepth,
      ...(reviewed ? { sourceFootprintSignature: reviewed.signature } : {}),
    },
    primitives: [{ attributes, indices, material, mode: 4 }],
  });
  const node = json.nodes.length;
  json.nodes.push({ name: "Fitted insertion geometry", mesh });
  json.scenes[0].nodes.push(node);
  const result = replaceImages(glb, new Map());
  return { bytes: result, pads, unchanged: false };
}
