import assert from "node:assert/strict";

export const FIREBOX_BACKSTOP = "Reconstructed sooty firebox backstop";

// Sculptural flames may be joined to the rear wall. Close the resulting opening
// behind the measured inner-wall envelope, without replacing surviving surfaces.
export function addFireboxBackstop(document, spec, frame = {}) {
  if (!spec) return null;
  const { minMM: lo, maxMM: hi, rgb, roughness } = spec;
  for (const values of [lo, hi, rgb])
    assert.ok(
      Array.isArray(values) &&
        values.length === 3 &&
        values.every(Number.isFinite),
    );
  assert.ok(lo.every((v, i) => v < hi[i]));
  assert.ok(hi[0] - lo[0] <= 0.5, "Backstop must remain a thin rear wall");
  assert.ok(Number.isFinite(spec.measuredInnerWallMinXMM));
  assert.ok(
    spec.measuredInnerWallMinXMM - hi[0] >= 0.02,
    "Backstop must sit behind surviving inner stone",
  );
  assert.ok(
    rgb.every((v) => v > 0 && v <= 1) && roughness >= 0 && roughness <= 1,
  );
  assert.ok(
    !document
      .getRoot()
      .listNodes()
      .some((n) => n.getName() === FIREBOX_BACKSTOP),
    "Backstop already exists",
  );
  const center = frame.mountCenterMM || [0, 0],
    shift = frame.nativeZShiftMM || 0;
  assert.ok(
    center.length === 2 &&
      center.every(Number.isFinite) &&
      Number.isFinite(shift),
  );
  const corners = Array.from({ length: 8 }, (_, i) => [
    i & 1 ? hi[0] : lo[0],
    i & 2 ? hi[1] : lo[1],
    i & 4 ? hi[2] : lo[2],
  ]);
  const faces = [
    [
      [0, 4, 6, 2],
      [-1, 0, 0],
    ],
    [
      [1, 3, 7, 5],
      [1, 0, 0],
    ],
    [
      [0, 1, 5, 4],
      [0, -1, 0],
    ],
    [
      [2, 6, 7, 3],
      [0, 1, 0],
    ],
    [
      [0, 2, 3, 1],
      [0, 0, -1],
    ],
    [
      [4, 5, 7, 6],
      [0, 0, 1],
    ],
  ];
  const positions = [],
    normals = [],
    indices = [];
  for (const [face, normal] of faces) {
    const start = positions.length / 3;
    for (const i of face) {
      const p = corners[i];
      positions.push(
        (p[0] - center[0]) / 35,
        (p[2] - shift) / 35,
        -(p[1] - center[1]) / 35,
      );
      normals.push(normal[0], normal[2], -normal[1]);
    }
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  const buffer = document.getRoot().listBuffers()[0] || document.createBuffer();
  const attribute = (type, array) =>
    document.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const linear = rgb.map(
    (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) * 0.9,
  );
  const material = document
    .createMaterial(FIREBOX_BACKSTOP)
    .setBaseColorFactor([...linear, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(roughness);
  const primitive = document
    .createPrimitive()
    .setAttribute("POSITION", attribute("VEC3", new Float32Array(positions)))
    .setAttribute("NORMAL", attribute("VEC3", new Float32Array(normals)))
    .setIndices(attribute("SCALAR", new Uint16Array(indices)))
    .setMaterial(material);
  document
    .getRoot()
    .listScenes()[0]
    .addChild(
      document
        .createNode(FIREBOX_BACKSTOP)
        .setMesh(document.createMesh().addPrimitive(primitive)),
    );
  return {
    profile: "measured-firebox-backstop-v1",
    minMM: lo,
    maxMM: hi,
    nativeZShiftMM: shift,
    triangles: 12,
    roughness,
    rgb,
  };
}
