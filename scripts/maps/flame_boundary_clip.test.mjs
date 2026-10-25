import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { clipMeasuredFlameBoundaries } from "./flame_boundary_clip.mjs";
import {
  stripSculptedFlames,
  retainPaintForFlameClipping,
} from "./model_flame_geometry.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { Document } = require("@gltf-transform/core"),
  {
    BufferGeometry,
    BufferAttribute,
    Ray,
    Vector3,
    DoubleSide,
  } = require("three"),
  { MeshBVH } = require("three-mesh-bvh");
function fixture() {
  const d = new Document(),
    b = d.createBuffer(),
    m = d.createMaterial().setEmissiveFactor([1, 0.5, 0.1]),
    p = d.createPrimitive().setMaterial(m);
  for (const [s, type, array] of [
    ["POSITION", "VEC3", [0, 0, 0, 1, 0, 0, 0, 0, 1]],
    ["NORMAL", "VEC3", [0, 1, 0, 0, 1, 0, 0, 1, 0]],
    ["TEXCOORD_0", "VEC2", [0, 0, 1, 0, 0, 1]],
  ])
    p.setAttribute(
      s,
      d
        .createAccessor()
        .setType(type)
        .setArray(new Float32Array(array))
        .setBuffer(b),
    );
  p.setIndices(
    d
      .createAccessor()
      .setType("SCALAR")
      .setArray(new Uint16Array([0, 1, 2]))
      .setBuffer(b),
  );
  d.createScene().addChild(
    d.createNode().setMesh(d.createMesh().addPrimitive(p)),
  );
  return { d, p, m };
}
const bounds = { minMM: [-1, -36, -1], maxMM: [36, 1, 1] };

test("render and LOD clipping use their declared tolerances independently", () => {
  const settings = {
    surfaceParts: [
      { kind: "flame", minMM: [17.5, -36, -1], maxMM: [36, 1, 1] },
    ],
    flameBoundaryClip: { toleranceMM: 0.25, lodToleranceMM: 0.5 },
  };
  for (const [tier, tolerance] of [
    ["render", 0.25],
    ["lod", 0.5],
  ]) {
    const { d } = fixture();
    const review = stripSculptedFlames(d, settings, 0, tier);
    assert.equal(review.boundaryToleranceMM, tolerance);
  }
});
test("clips mixed fuel/fire triangles and preserves the continuous position/UV surface", () => {
  const { d, p, m } = fixture();
  clipMeasuredFlameBoundaries(d, (q) => q[0] > 17.5, [0, 0, 0], {
    toleranceMM: 0.25,
    boundsMM: [bounds],
  });
  const a = p.getAttribute("POSITION"),
    uv = p.getAttribute("TEXCOORD_0");
  assert.ok(p.getIndices().getCount() > 0);
  for (let i = 0; i < a.getCount(); i++) {
    const q = a.getElement(i, []),
      t = uv.getElement(i, []);
    assert.ok(q[0] * 35 <= 17.50001);
    assert.ok(Math.abs(q[0] - t[0]) < 1e-6 && Math.abs(q[2] - t[1]) < 1e-6);
  }
  assert.deepEqual(m.getEmissiveFactor(), [0, 0, 0]);
});
test("retains a small solid pocket even when the parent corners and centre look like fire", () => {
  const { d, p } = fixture();
  clipMeasuredFlameBoundaries(
    d,
    (q) => Math.hypot(q[0] - 8.75, q[1] + 8.75) > 3,
    [0, 0, 0],
    { toleranceMM: 0.25, boundsMM: [bounds], preserveRegions: [bounds] },
  );
  const a = p.getAttribute("POSITION"),
    idx = p.getIndices(),
    v = [];
  for (let i = 0; i < idx.getCount(); i++)
    v.push(...a.getElement(idx.getScalar(i), []));
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(v), 3));
  const tree = new MeshBVH(g),
    hit = tree.raycastFirst(
      new Ray(new Vector3(0.25, 1, 0.25), new Vector3(0, -1, 0)),
      DoubleSide,
    );
  assert.ok(hit);
  assert.ok(Math.abs(hit.point.y) < 1e-8);
});
test("rejects nonpositive clipping tolerance before changing the model", () => {
  const { d, p } = fixture(),
    before = p.getAttribute("POSITION");
  assert.throws(() =>
    clipMeasuredFlameBoundaries(d, () => true, [0, 0, 0], {
      toleranceMM: 0,
      boundsMM: [bounds],
    }),
  );
  assert.equal(p.getAttribute("POSITION"), before);
});

test("paint interpolation remains available after normalized export colours are prepared for clipping", () => {
  const { d, p } = fixture(),
    buffer = d.getRoot().listBuffers()[0],
    positions = p.getAttribute("POSITION");
  const paint = d
    .createAccessor()
    .setType("VEC4")
    .setArray(
      new Uint16Array([
        32768, 10000, 20000, 65535, 32768, 10000, 20000, 65535, 32768, 10000,
        20000, 65535,
      ]),
    )
    .setNormalized(true)
    .setBuffer(buffer);
  p.setAttribute("COLOR_1", paint);
  p.setAttribute("COLOR_0", paint.clone());
  retainPaintForFlameClipping(d);
  assert.equal(p.getAttribute("POSITION"), positions);
  assert.equal(p.getAttribute("COLOR_0"), null);
  assert.ok(p.getAttribute("COLOR_1").getArray() instanceof Float32Array);
  assert.equal(p.getAttribute("COLOR_1").getNormalized(), false);
  assert.ok(
    Math.abs(p.getAttribute("COLOR_1").getElement(0, [])[0] - 32768 / 65535) <
      1e-7,
  );
  clipMeasuredFlameBoundaries(d, (q) => q[0] > 17.5, [0, 0, 0], {
    toleranceMM: 0.25,
    boundsMM: [bounds],
  });
  assert.ok(p.getAttribute("COLOR_1").getCount() > 0);
});

test("clipping a shifted native flame retains the original body and UV frame", () => {
  const {d,p} = fixture();
  stripSculptedFlames(d,{
    surfaceParts:[{kind:"flame",minMM:[87.5,-71,16],maxMM:[106,-34,18]}],
    flameBoundaryClip:{toleranceMM:.25},
  },17,"render",[70,-35]);
  const a=p.getAttribute("POSITION"),uv=p.getAttribute("TEXCOORD_0"),idx=p.getIndices();
  let area=0,maxX=-Infinity;
  for(let i=0;i<a.getCount();i++){
    const q=a.getElement(i,[]),t=uv.getElement(i,[]);maxX=Math.max(maxX,q[0]);
    assert.ok(q[0]<=.50001);
    assert.ok(Math.abs(q[0]-t[0])<1e-6&&Math.abs(q[2]-t[1])<1e-6);
  }
  for(let i=0;i<idx.getCount();i+=3){
    const [u,v,w]=[0,1,2].map(j=>a.getElement(idx.getScalar(i+j),[]));
    area+=Math.abs((v[0]-u[0])*(w[2]-u[2])-(v[2]-u[2])*(w[0]-u[0]))/2;
  }
  assert.ok(Math.abs(maxX-.5)<1e-5);
  assert.ok(Math.abs(area-.375)<1e-4);
});
