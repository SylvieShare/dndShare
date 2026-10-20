import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readGlb, replaceImages } from "./glb_textures.mjs";
import { measurePads, pegPrimitive } from "./peg-geometry.mjs";
import profile from "./standard-mount-profile.json" with { type: "json" };
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { Document, NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { dequantize } = require("@gltf-transform/functions");
const { MeshoptDecoder } = require("meshoptimizer");
export const STANDARD_MOUNT = Object.freeze(profile);
const isPeg = (name) =>
  name === "Insertion earth" || name?.startsWith("Simple insertion pegs");
async function decode(bytes) {
  await MeshoptDecoder.ready;
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .readBinary(bytes);
  await doc.transform(dequantize());
  return doc;
}
export function standardMountMetadata(model) {
  assert.ok(
    Number.isFinite(model.mountDepth) &&
      model.mountDepth > 0 &&
      model.mountDepth < 1,
    "Measured ordinary insertion depth required",
  );
  const next = structuredClone(model),
    delta = STANDARD_MOUNT.depth - model.mountDepth;
  next.mountDepth = STANDARD_MOUNT.depth;
  const shift = (v) => {
    assert.ok(Number.isFinite(v), "Finite geometric height required");
    return Number((v + delta).toFixed(6));
  };
  for (const key of ["surfaceHeight", "maxHeight"])
    next[key] = shift(model[key]);
  for (const p of next.placementPoints ?? []) p.elevation = shift(p.elevation);
  for (const p of next.supportSlots ?? []) p.elevation = shift(p.elevation);
  return next;
}
export function standardMountPads(pads) {
  assert.ok(pads.length, "At least one existing pad required");
  return pads.map((p) => {
    const top = { min: [], max: [] },
      bottom = { min: [], max: [] };
    for (let a = 0; a < 2; a++) {
      const width = p.top.max[a] - p.top.min[a];
      assert.ok(
        width >= 0.95 && width <= 1.05,
        "Inspect non-cell-sized insertion separately",
      );
      const c = (p.top.min[a] + p.top.max[a]) / 2;
      top.min[a] = c - 0.5;
      top.max[a] = c + 0.5;
      bottom.min[a] = c - STANDARD_MOUNT.bottomWidth / 2;
      bottom.max[a] = c + STANDARD_MOUNT.bottomWidth / 2;
    }
    return { top, bottom };
  });
}
function world(v, m) {
  return [0, 1, 2].map(
    (a) => m[a] * v[0] + m[a + 4] * v[1] + m[a + 8] * v[2] + m[a + 12],
  );
}
export async function validateStandardMount(bytes, model) {
  assert.equal(
    model.mountDepth,
    STANDARD_MOUNT.depth,
    "Mount metadata differs from UD-016",
  );
  const doc = await decode(bytes);
  let count = 0;
  for (const n of doc.getRoot().listNodes())
    if (n.getMesh()) {
      const mesh = n.getMesh(),
        marked =
          mesh.getExtras().dndShareInsertionProfile === STANDARD_MOUNT.name;
      for (const p of mesh.listPrimitives())
        if (isPeg(p.getMaterial()?.getName())) {
          assert.ok(marked, "Unmarked insertion geometry");
          assert.equal(p.getMaterial().getEmissiveTexture(), null);
          assert.ok(
            p
              .getMaterial()
              .getEmissiveFactor()
              .every((v) => v === 0),
            "Mount must not emit light",
          );
          const pads = mesh.getExtras().pads;
          assert.ok(Array.isArray(pads) && pads.length);
          const pos = p.getAttribute("POSITION"),
            idx = p.getIndices(),
            M = n.getWorldMatrix(),
            byPad = pads.map(() => ({
              faces: new Map(),
              edges: new Map(),
              corners: new Set(),
            }));
          function corner(v, onlyPad) {
            for (let i = 0; i < pads.length; i++) {
              if (i !== onlyPad) continue;
              const c = pads[i].center;
              for (const y of [0, STANDARD_MOUNT.depth]) {
                if (Math.abs(v[1] - y) > STANDARD_MOUNT.tolerance) continue;
                const r = (y === 0 ? STANDARD_MOUNT.bottomWidth : 1) / 2;
                for (const sx of [-1, 1])
                  for (const sz of [-1, 1])
                    if (
                      Math.abs(v[0] - c[0] - sx * r) <=
                        STANDARD_MOUNT.tolerance &&
                      Math.abs(v[2] - c[1] - sz * r) <= STANDARD_MOUNT.tolerance
                    )
                      return {
                        i,
                        id: `${y === 0 ? 0 : 1}:${sx}:${sz}`,
                        y,
                        sx,
                        sz,
                      };
              }
            }
            return null;
          }
          assert.equal(
            idx.getCount(),
            pads.length * 36,
            "Twelve triangles per pad required",
          );
          for (let j = 0; j < idx.getCount(); j += 3) {
            const vertices = [0, 1, 2].map((k) =>
                world(pos.getElement(idx.getScalar(j + k), []), M),
              ),
              matches = pads
                .map((_, i) => vertices.map((v) => corner(v, i)))
                .filter((c) => c.every(Boolean));
            assert.equal(
              matches.length,
              1,
              "Triangle must belong to exactly one pad",
            );
            const c = matches[0];
            const b = byPad[c[0].i];
            c.forEach((q) => b.corners.add(q.id));
            const face = c.every((q) => q.y === 0)
              ? "bottom"
              : c.every((q) => q.y === STANDARD_MOUNT.depth)
                ? "top"
                : c.every((q) => q.sx === c[0].sx)
                  ? "x" + c[0].sx
                  : c.every((q) => q.sz === c[0].sz)
                    ? "z" + c[0].sz
                    : null;
            assert.ok(face, "Triangle crosses a side");
            b.faces.set(face, (b.faces.get(face) ?? 0) + 1);
            for (let k = 0; k < 3; k++) {
              const e = [c[k].id, c[(k + 1) % 3].id].sort().join("|");
              b.edges.set(e, (b.edges.get(e) ?? 0) + 1);
            }
            const [a, d, e] = vertices,
              ab = d.map((v, k) => v - a[k]),
              ac = e.map((v, k) => v - a[k]),
              normal = [
                ab[1] * ac[2] - ab[2] * ac[1],
                ab[2] * ac[0] - ab[0] * ac[2],
                ab[0] * ac[1] - ab[1] * ac[0],
              ],
              center = [
                pads[c[0].i].center[0],
                STANDARD_MOUNT.depth / 2,
                pads[c[0].i].center[1],
              ];
            assert.ok(
              normal.reduce((s, v, k) => s + v * (a[k] - center[k]), 0) > 0,
              "Inward or degenerate insertion face",
            );
          }
          for (const b of byPad) {
            assert.equal(b.corners.size, 8);
            assert.equal(b.faces.size, 6);
            assert.ok([...b.faces.values()].every((v) => v === 2));
            assert.ok(
              [...b.edges.values()].every((v) => v === 2),
              "Insertion is not a closed surface",
            );
          }
          count += pads.length;
        }
    }
  assert.ok(count, "No standard insertion geometry");
  return { profile: STANDARD_MOUNT.name, pads: count };
}
// Keep all old byte buffers. Only scene-root offsets and a tiny appended insertion change.
export async function fitStandardMount(bytes, model) {
  const source = readGlb(Buffer.from(bytes)),
    json = source.json;
  assert.equal(json.scenes.length, 1, "One static scene required");
  assert.ok(!json.animations?.length, "Inspect animated scene separately");
  const mounts = json.meshes.filter((m) =>
    m.primitives.some((p) => isPeg(json.materials[p.material]?.name)),
  );
  if (!mounts.length) {
    assert.equal(
      model.mountDepth,
      0,
      "Native or unknown insertion requires separate inspection",
    );
    return { bytes, model: structuredClone(model), pads: [], unchanged: true };
  }
  if (
    mounts.every(
      (m) => m.extras?.dndShareInsertionProfile === STANDARD_MOUNT.name,
    )
  ) {
    await validateStandardMount(bytes, model);
    return {
      bytes,
      model: structuredClone(model),
      pads: mounts.flatMap((m) => m.extras.pads),
      unchanged: true,
    };
  }
  const next = standardMountMetadata(model),
    doc = await decode(bytes),
    parts = [];
  for (const n of doc.getRoot().listNodes())
    if (n.getMesh())
      for (const p of n.getMesh().listPrimitives())
        if (isPeg(p.getMaterial()?.getName()))
          parts.push({ primitive: p, matrix: n.getWorldMatrix() });
  const pads = standardMountPads(measurePads(parts, model.mountDepth));
  const primitive = pegPrimitive(
    new Document(),
    pads,
    STANDARD_MOUNT.depth,
    "ultimate-dungeon",
  );
  const removed = new Set();
  let material;
  json.meshes.forEach((m, i) => {
    const flags = m.primitives.map((p) =>
      isPeg(json.materials[p.material]?.name),
    );
    if (!flags.some(Boolean)) return;
    assert.ok(flags.every(Boolean), "Body and insertion share a mesh");
    for (const p of m.primitives) {
      material ??= p.material;
      assert.equal(
        p.material,
        material,
        "Different pad materials require inspection",
      );
    }
    removed.add(i);
  });
  assert.ok(removed.size);
  const remap = new Map();
  json.meshes = json.meshes.filter((m, i) => {
    if (removed.has(i)) return false;
    remap.set(i, remap.size);
    return true;
  });
  for (const n of json.nodes)
    if (n.mesh !== undefined) {
      if (removed.has(n.mesh)) delete n.mesh;
      else n.mesh = remap.get(n.mesh);
    }
  const delta = STANDARD_MOUNT.depth - model.mountDepth;
  for (const i of json.scenes[0].nodes) {
    const n = json.nodes[i];
    if (n.matrix) n.matrix[13] += delta;
    else {
      n.translation ??= [0, 0, 0];
      n.translation[1] += delta;
    }
  }
  function append(values, scalar = false) {
    const offset = Math.ceil(json.buffers[0].byteLength / 4) * 4,
      payload = Buffer.from(
        values.buffer,
        values.byteOffset,
        values.byteLength,
      ),
      bin = Buffer.alloc(offset + payload.length);
    source.bin.copy(bin, 0, 0, json.buffers[0].byteLength);
    payload.copy(bin, offset);
    source.bin = bin;
    json.buffers[0].byteLength = bin.length;
    const view = json.bufferViews.length;
    json.bufferViews.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: payload.length,
      target: scalar ? 34963 : 34962,
    });
    const accessor = json.accessors.length,
      stride = scalar ? 1 : 3,
      min = Array(stride).fill(Infinity),
      max = Array(stride).fill(-Infinity);
    for (let i = 0; i < values.length; i++) {
      min[i % stride] = Math.min(min[i % stride], values[i]);
      max[i % stride] = Math.max(max[i % stride], values[i]);
    }
    json.accessors.push({
      bufferView: view,
      componentType: scalar ? 5123 : 5126,
      count: values.length / stride,
      type: scalar ? "SCALAR" : "VEC3",
      min,
      max,
    });
    return accessor;
  }
  const positions = primitive.getAttribute("POSITION").getArray(),
    normals = primitive.getAttribute("NORMAL").getArray(),
    attributes = { POSITION: append(positions), NORMAL: append(normals) },
    indices = append(
      Uint16Array.from({ length: positions.length / 3 }, (_, i) => i),
      true,
    ),
    mesh = json.meshes.length;
  const padInfo = pads.map((p) => ({
    center: p.top.min.map((v, i) => (v + p.top.max[i]) / 2),
  }));
  json.meshes.push({
    name: "UD-016 standard insertion",
    extras: {
      dndShareInsertionProfile: STANDARD_MOUNT.name,
      referenceDefinitionId: STANDARD_MOUNT.referenceDefinitionId,
      mountDepth: STANDARD_MOUNT.depth,
      pads: padInfo,
    },
    primitives: [{ attributes, indices, material, mode: 4 }],
  });
  const node = json.nodes.length;
  json.nodes.push({ name: "UD-016 standard insertion", mesh });
  json.scenes[0].nodes.push(node);
  const result = replaceImages(source, new Map());
  await validateStandardMount(result, next);
  return { bytes: result, model: next, pads, delta, unchanged: false };
}
export async function verifyStandardMountBody(
  before,
  after,
  oldModel,
  newModel,
) {
  const a = readGlb(Buffer.from(before)),
    b = readGlb(Buffer.from(after));
  assert.deepEqual(
    b.bin.subarray(0, a.json.buffers[0].byteLength),
    a.bin.subarray(0, a.json.buffers[0].byteLength),
    "Original compressed byte buffers changed",
  );
  for (const f of ["materials", "textures", "images"])
    assert.deepEqual(b.json[f], a.json[f]);
  assert.deepEqual(
    b.json.accessors.slice(0, a.json.accessors.length),
    a.json.accessors,
  );
  assert.deepEqual(
    b.json.bufferViews.slice(0, a.json.bufferViews.length),
    a.json.bufferViews,
  );
  const collect = async (bytes) => {
    const d = await decode(bytes),
      r = new Map();
    for (const n of d.getRoot().listNodes())
      if (n.getMesh())
        for (const [i, p] of n.getMesh().listPrimitives().entries())
          if (!isPeg(p.getMaterial()?.getName())) {
            const a = p.getAttribute("POSITION"),
              m = n.getWorldMatrix();
            r.set(
              n.getName() + ":" + i,
              Array.from({ length: a.getCount() }, (_, j) =>
                world(a.getElement(j, []), m),
              ),
            );
          }
    return r;
  };
  const aa = await collect(before),
    bb = await collect(after);
  assert.deepEqual([...bb.keys()], [...aa.keys()]);
  let maximumWorldDriftMM = 0,
    bodyVertices = 0;
  for (const [key, points] of aa) {
    const updated = bb.get(key);
    assert.equal(updated.length, points.length);
    for (let i = 0; i < points.length; i++) {
      for (let j = 0; j < 3; j++)
        maximumWorldDriftMM = Math.max(
          maximumWorldDriftMM,
          Math.abs(
            points[i][j] -
              (j === 1 ? oldModel.mountDepth : 0) -
              updated[i][j] +
              (j === 1 ? newModel.mountDepth : 0),
          ) * 35,
        );
      bodyVertices++;
    }
  }
  assert.ok(
    maximumWorldDriftMM < 0.00001,
    "Visible body moved after placement",
  );
  return {
    bodyBuffersAndTexturesUnchanged: true,
    bodyVertices,
    maximumWorldDriftMM,
  };
}
export async function standardMountAssetInfo(bytes) {
  const doc = await decode(bytes),
    { getBounds } = require("@gltf-transform/functions");
  return {
    bounds: getBounds(doc.getRoot().listScenes()[0]),
    triangles: doc
      .getRoot()
      .listMeshes()
      .reduce(
        (n, m) =>
          n +
          m
            .listPrimitives()
            .reduce(
              (n, p) =>
                n +
                (p.getIndices()?.getCount() ??
                  p.getAttribute("POSITION").getCount()) /
                  3,
              0,
            ),
        0,
      ),
  };
}
