import assert from "node:assert/strict";

export const CANDLE_WAX_CAP = "Reconstructed candle wax surface ";

// Seal a removed flame's attachment below the measured surviving wax rim.
// The source mesh, UVs, textures and materials remain untouched.
export function addCandleWaxCaps(document, specs, frame = {}) {
  if (!specs?.length) return [];
  const center = frame.mountCenterMM || [0, 0];
  const shift = frame.nativeZShiftMM || 0;
  assert.ok(center.length === 2 && center.every(Number.isFinite) && Number.isFinite(shift));
  const names = new Set(document.getRoot().listNodes().map(node => node.getName()));
  for (const spec of specs) {
    assert.ok(typeof spec.key === "string" && spec.key.length);
    const name = CANDLE_WAX_CAP + spec.key;
    assert.ok(!names.has(name), "Candle wax surface already exists");
    names.add(name);
    for (const values of [spec.centreMM, spec.radiiMM])
      assert.ok(Array.isArray(values) && values.length === 2 && values.every(Number.isFinite));
    assert.ok(spec.radiiMM.every(value => value > 0 && value <= 2.5));
    assert.ok(Number.isFinite(spec.topMM) && Number.isFinite(spec.bottomMM));
    assert.ok(spec.topMM - spec.bottomMM > .02 && spec.topMM - spec.bottomMM <= .3);
    assert.ok(spec.measuredWaxRimMinMM - spec.topMM >= .02, "Wax surface must stay below the surviving rim");
    assert.ok(Number.isInteger(spec.measuredRimSamples) && spec.measuredRimSamples > 0);
    assert.match(spec.measurementSourceSHA256, /^[a-f0-9]{64}$/);
    if (frame.sourceSHA256 !== undefined)
      assert.equal(spec.measurementSourceSHA256, frame.sourceSHA256, "Wax measurements belong to a different source");
    assert.ok(spec.rgb?.length === 3 && spec.rgb.every(value => Number.isFinite(value) && value > 0 && value <= 1));
    assert.ok(Number.isFinite(spec.roughness) && spec.roughness >= 0 && spec.roughness <= 1);
  }
  const buffer = document.getRoot().listBuffers()[0] || document.createBuffer();
  const scene = document.getRoot().listScenes()[0];
  assert.ok(scene, "Candle wax surface needs an existing scene");
  return specs.map(spec => {
    const name = CANDLE_WAX_CAP + spec.key;
    const positions = [], normals = [], indices = [], segments = 32;
    const world = point => [(point[0] - center[0]) / 35, (point[2] - shift) / 35, -(point[1] - center[1]) / 35];
    const ring = (i, height) => {
      const angle = (i % segments) * Math.PI * 2 / segments;
      return [spec.centreMM[0] + spec.radiiMM[0] * Math.cos(angle), spec.centreMM[1] + spec.radiiMM[1] * Math.sin(angle), height];
    };
    const triangle = native => {
      const points = native.map(world), a = points[1].map((value, i) => value - points[0][i]), b = points[2].map((value, i) => value - points[0][i]);
      const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const length = Math.hypot(...cross);
      assert.ok(length > 0);
      for (const point of points) {
        indices.push(positions.length / 3);
        positions.push(...point);
        normals.push(...cross.map(value => value / length));
      }
    };
    for (let i = 0; i < segments; i++) {
      const bottom = ring(i, spec.bottomMM), nextBottom = ring(i + 1, spec.bottomMM), top = ring(i, spec.topMM), nextTop = ring(i + 1, spec.topMM);
      triangle([[...spec.centreMM, spec.topMM], top, nextTop]);
      triangle([[...spec.centreMM, spec.bottomMM], nextBottom, bottom]);
      triangle([bottom, nextBottom, nextTop]);
      triangle([bottom, nextTop, top]);
    }
    const attribute = (type, values) => document.createAccessor().setType(type).setArray(values).setBuffer(buffer);
    const linear = spec.rgb.map(value => (value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4) * .9);
    const material = document.createMaterial(name).setBaseColorFactor([...linear, 1]).setMetallicFactor(0).setRoughnessFactor(spec.roughness);
    const primitive = document.createPrimitive()
      .setAttribute("POSITION", attribute("VEC3", new Float32Array(positions)))
      .setAttribute("NORMAL", attribute("VEC3", new Float32Array(normals)))
      .setIndices(attribute("SCALAR", new Uint16Array(indices))).setMaterial(material);
    scene.addChild(document.createNode(name).setMesh(document.createMesh(name).addPrimitive(primitive)));
    return { ...structuredClone(spec), triangles: indices.length / 3 };
  });
}
