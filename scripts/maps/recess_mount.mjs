import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readGlb, replaceImages } from "./glb_textures.mjs";
import {
  STANDARD_MOUNT,
  standardMountMetadata,
  verifyStandardMountBody,
} from "./standard_mount.mjs";

export const RECESS_MOUNT = "ud016-recess-v1";
export const RECESS_OUTER = "UD-016 recessed insertion";
export const RECESS_HIDDEN = "Recess well underside";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { MeshoptDecoder } = require("meshoptimizer");
const {
  BufferGeometry,
  BufferAttribute,
  Vector3,
  Ray,
  DoubleSide,
} = require("three");
const { MeshBVH } = require("three-mesh-bvh");

export function recessProfileID(code) {
  assert.match(code, /^MT1-\d{3}$/);
  return "ud016-recess-" + code.toLowerCase() + "-v1";
}
export function validateRecessConstruction(construction, sourceHash) {
  assert.equal(construction?.profile, RECESS_MOUNT);
  assert.equal(construction.sourceSHA256, sourceHash);
  assert.match(sourceHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(construction.reference, STANDARD_MOUNT);
  for (const key of [
    "boundaryEdges",
    "wireEdges",
    "multiEdges",
    "inconsistentEdges",
  ])
    assert.equal(
      construction.topology[key],
      0,
      "Recess construction topology: " + key,
    );
  assert.ok(construction.cavityFaces > 0 && construction.upperFaces > 0);
  assert.ok(
    construction.topology.volume > 0 &&
      Number.isFinite(construction.nativeDatumMM),
  );
  assert.ok(
    construction.maximumCavityDeviationMM <= STANDARD_MOUNT.tolerance * 35,
  );
  assert.ok(
    construction.maximumUpperDeviationMM <= STANDARD_MOUNT.tolerance * 35,
  );
  assert.ok(
    construction.cavityProbesMM?.length > 0,
    "Native recess visibility probes required",
  );
  for (const point of construction.cavityProbesMM) {
    assert.equal(point.length, 3);
    assert.ok(
      point.every(Number.isFinite) &&
        point[2] < construction.nativeDatumMM - 0.05,
    );
  }
}
function world(v, m) {
  return [0, 1, 2].map(
    (a) => m[a] * v[0] + m[a + 4] * v[1] + m[a + 8] * v[2] + m[a + 12],
  );
}
export async function validateRecessMount(bytes, model, construction) {
  validateRecessConstruction(construction, construction?.sourceSHA256);
  assert.equal(model.mountProfile, recessProfileID(model.sourceCode));
  assert.equal(model.width, 1);
  assert.equal(model.height, 1);
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const doc = await io.readBinary(bytes),
    vertices = [],
    corners = new Set(),
    planes = new Set();
  const top = model.mountDepth,
    bottom = top - STANDARD_MOUNT.depth;
  const rt = STANDARD_MOUNT.topWidth / 2,
    rb = STANDARD_MOUNT.bottomWidth / 2;
  const slope = (rt - rb) / STANDARD_MOUNT.depth,
    intercept = rb - slope * bottom,
    tol = STANDARD_MOUNT.tolerance;
  const normals = [
    [0, 1, 0],
    [0, -1, 0],
    [1, -slope, 0],
    [-1, -slope, 0],
    [0, -slope, 1],
    [0, -slope, -1],
  ];
  const constants = [top, -bottom, intercept, intercept, intercept, intercept];
  let outerCount = 0,
    hiddenCount = 0;
  for (const node of doc.getRoot().listNodes())
    if (node.getMesh())
      for (const p of node.getMesh().listPrimitives()) {
        const name = p.getMaterial()?.getName() || "";
        assert.ok(
          !/^(Insertion earth|Simple insertion pegs)/.test(name),
          "Solid insertion cannot be added to a recess",
        );
        const pos = p.getAttribute("POSITION"),
          idx = p.getIndices(),
          matrix = node.getWorldMatrix();
        assert.ok(
          idx && p.getMode() === 4,
          "Static indexed triangles required",
        );
        if (name === RECESS_HIDDEN) hiddenCount++;
        for (let i = 0; i < idx.getCount(); i += 3) {
          const triangle = [0, 1, 2].map((j) =>
            world(pos.getElement(idx.getScalar(i + j), []), matrix),
          );
          vertices.push(...triangle.flat());
          if (name !== RECESS_OUTER) continue;
          outerCount++;
          for (const v of triangle) {
            assert.ok(
              v[1] >= bottom - tol && v[1] <= top + tol,
              "Recess outer depth differs from UD-016",
            );
            const radius = rb + slope * (v[1] - bottom);
            assert.ok(
              Math.max(Math.abs(v[0]), Math.abs(v[2])) <= radius + tol,
              "Recess outer section differs from UD-016",
            );
            for (const [level, y, r] of [
              [0, bottom, rb],
              [1, top, rt],
            ])
              for (const sx of [-1, 1])
                for (const sz of [-1, 1])
                  if (
                    Math.abs(v[0] - sx * r) <= tol &&
                    Math.abs(v[1] - y) <= tol &&
                    Math.abs(v[2] - sz * r) <= tol
                  )
                    corners.add(`${level}:${sx}:${sz}`);
          }
          const matches = normals
            .map((n, k) => ({ n, k }))
            .filter(({ n, k }) =>
              triangle.every(
                (v) =>
                  Math.abs(
                    n.reduce((a, c, j) => a + c * v[j], 0) - constants[k],
                  ) <=
                  tol * Math.hypot(...n),
              ),
            );
          assert.ok(
            matches.length,
            "Outer face is not on the shared frustum envelope",
          );
          const a = new Vector3(...triangle[0]),
            b = new Vector3(...triangle[1]),
            c = new Vector3(...triangle[2]);
          const normal = b.clone().sub(a).cross(c.clone().sub(a)),
            area = normal.length();
          const edge = Math.max(
            a.distanceTo(b),
            a.distanceTo(c),
            b.distanceTo(c),
          );
          if (area > 1e-12)
            matches.sort(
              (u, v) =>
                normal.dot(new Vector3(...v.n).normalize()) -
                normal.dot(new Vector3(...u.n).normalize()),
            );
          const plane = matches[0].k;
          planes.add(plane);
          if (edge && area / edge > 4 * tol) {
            const facing = normal
              .normalize()
              .dot(new Vector3(...normals[plane]).normalize());
            assert.ok(
              facing > 0.9,
              "Recess outer face orientation " +
                JSON.stringify({
                  plane,
                  facing,
                  altitudeMM: (area / edge) * 35,
                  triangle,
                }),
            );
          }
        }
      }
  assert.ok(outerCount > 0, "Measured outer envelope required");
  if (construction.hiddenTriangles)
    assert.ok(hiddenCount > 0, "Functional well shell is missing");
  assert.equal(corners.size, 8, "All UD-016 corner landmarks required");
  assert.equal(planes.size, 6, "All six UD-016 outer planes required");
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(vertices), 3),
  );
  const tree = new MeshBVH(geometry);
  let maximumDeviationMM = 0;
  for (const point of construction.cavityProbesMM) {
    const expected = new Vector3(
      point[0] / 35,
      (point[2] - construction.nativeDatumMM) / 35 + top,
      -point[1] / 35,
    );
    const hit = tree.raycastFirst(
      new Ray(
        new Vector3(expected.x, model.maxHeight + 1, expected.z),
        new Vector3(0, -1, 0),
      ),
      DoubleSide,
    );
    assert.ok(hit, "Native recessed floor is missing");
    maximumDeviationMM = Math.max(
      maximumDeviationMM,
      hit.point.distanceTo(expected) * 35,
    );
  }
  geometry.dispose();
  assert.ok(
    maximumDeviationMM <= 0.15,
    "Mount filled or changed the native recess: " + maximumDeviationMM,
  );
  return {
    profile: RECESS_MOUNT,
    outerTriangles: outerCount,
    cavityProbes: construction.cavityProbesMM.length,
    maximumDeviationMM,
  };
}
export async function fitRecessMount(bytes, model, construction) {
  await validateRecessMount(bytes, model, construction);
  const next = standardMountMetadata(model),
    source = readGlb(Buffer.from(bytes));
  assert.equal(source.json.scenes.length, 1);
  assert.ok(!source.json.animations?.length);
  const delta = next.mountDepth - model.mountDepth;
  for (const i of source.json.scenes[0].nodes) {
    const node = source.json.nodes[i];
    if (node.matrix) node.matrix[13] += delta;
    else {
      node.translation ??= [0, 0, 0];
      node.translation[1] += delta;
    }
  }
  const after = replaceImages(source, new Map());
  await validateRecessMount(after, next, construction);
  await verifyStandardMountBody(bytes, after, model, next);
  return { bytes: after, model: next, unchanged: delta === 0 };
}

export function validateRecessFrameRecord(fit, report, inventory) {
  assert.equal(fit.schemaVersion, 1);
  assert.equal(fit.sourceCode, report.model.sourceCode);
  assert.equal(fit.profile, report.model.mountProfile);
  assert.equal(fit.sourceSHA256, report.sourceSHA256);
  assert.deepEqual(fit.reference, STANDARD_MOUNT);
  assert.deepEqual(report.recessFrameFit?.assets, fit.assets);
  assert.equal(
    report.recessFrameFit.lowerSurfaceSHA256,
    fit.lowerSurfaceSHA256,
  );
  assert.equal(fit.frames.length, 15);
  assert.equal(
    fit.frames.reduce((n, f) => n + f.slots.length, 0),
    90,
  );
  const expected = inventory
    .filter((r) => Number(r.code.slice(4)) >= 700)
    .map((r) => r.code)
    .sort();
  assert.deepEqual(
    fit.frames.map((f) => f.code).sort(),
    expected,
    "Every native frame must be fitted exactly once",
  );
  for (const frame of fit.frames) {
    const row = inventory.find((r) => r.code === frame.code);
    assert.equal(
      frame.sourceSHA256,
      row?.sourceSHA256,
      "Native fitted frame identity changed",
    );
    const w = Math.round((row.max[0] - row.min[0]) / 35),
      h = Math.round((row.max[1] - row.min[1]) / 35);
    assert.equal(new Set(frame.slots.map((s) => s.x + ":" + s.y)).size, w * h);
    for (const slot of frame.slots) {
      assert.ok(
        Number.isInteger(slot.x) &&
          Number.isInteger(slot.y) &&
          slot.x >= 0 &&
          slot.x < w &&
          slot.y >= 0 &&
          slot.y < h,
      );
      assert.ok(
        Math.abs(slot.centerMM[0] - (slot.x - (w - 1) / 2) * 35) < 0.0001 &&
          Math.abs(slot.centerMM[1] - ((h - 1) / 2 - slot.y) * 35) < 0.0001,
        "Fitted frame cells must use local downward-Y indices",
      );
      assert.ok(
        Number.isFinite(slot.verifiedSeatMM) &&
          Number.isFinite(slot.minimumSeatMM) &&
          slot.verifiedSeatMM >= slot.minimumSeatMM + 0.019,
      );
      const rise = slot.verifiedSeatMM - row.max[2];
      assert.ok(
        Number.isFinite(slot.insertionRiseMM) &&
          Math.abs(slot.insertionRiseMM - rise) < 0.00001 &&
          rise >= 0 &&
          rise / 35 <= 0.15,
      );
    }
  }
  return fit;
}
export async function validateRecessFrameFit(report, directory) {
  const file = path.join(
    import.meta.dirname,
    "recess-frame-fits",
    report.model.sourceCode + ".json",
  );
  const fit = JSON.parse(await fs.readFile(file, "utf8"));
  const inventory = JSON.parse(
    await fs.readFile(path.resolve(directory, "../../inventory.json"), "utf8"),
  );
  validateRecessFrameRecord(fit, report, inventory);
  for (const tier of ["render", "lod", "shadow"]) {
    const bytes = await fs.readFile(path.join(directory, tier + ".glb"));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      fit.assets[tier],
      "Recess frame fit differs from final " + tier,
    );
  }
  return fit;
}
