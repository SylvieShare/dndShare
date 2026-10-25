// Source seating, pre-normalization metadata, then final receiving-mesh proof.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  sourceSocketProbes,
  SOCKET_PROBE_VERSION,
  receiverTriangles as triangles,
} from "./receiver_geometry.mjs";
import { fitReceiverGeometry } from "./receiver_cell_fit.mjs";
import { receiverCells, receiverSlotForCell } from "./receiver_cells.mjs";
import { STANDARD_MOUNT as S } from "./standard_mount.mjs";
import { matchesPreparedPublication } from "./medieval_publication.mjs";
import { refreshReceiverSupportSlots } from "./receiver_frame_review.mjs";
import { recessProfileID, validateRecessMount } from "./recess_mount.mjs";
const req = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { NodeIO } = req("@gltf-transform/core"),
  { ALL_EXTENSIONS } = req("@gltf-transform/extensions"),
  { MeshoptDecoder } = req("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder }),
  root = path.resolve(import.meta.dirname, "../.."),
  base = path.join(root, "models/collections/medieval-town-vol1"),
  code = process.argv[2],
  mode = process.argv[3],
  hash = (b) => createHash("sha256").update(b).digest("hex");
assert.match(code ?? "", /^MT1-\d{3}$/);
assert.ok(["source", "native", "final"].includes(mode));
const preparedInsertion = process.argv
  .find((a) => a.startsWith("--prepared-insertion="))
  ?.split("=")[1];
if (preparedInsertion) assert.match(preparedInsertion, /^MT1-\d{3}$/);
const refreshSlots = process.argv.includes("--refresh-slots");
if (refreshSlots) assert.equal(mode, "final");
const inv = JSON.parse(await fs.readFile(base + "/inventory.json", "utf8")),
  row = inv.find((v) => v.code === code),
  index = JSON.parse(
    await fs.readFile(
      path.join(import.meta.dirname, "medieval-recipes.json"),
      "utf8",
    ),
  ),
  recipe = JSON.parse(
    await fs.readFile(path.join(import.meta.dirname, index[code]), "utf8"),
  );
assert.ok(
  recipe.tileType === "frame" &&
    recipe.mountCenterMM.every((v) => v === 0),
  "Measured receiving coordinates required",
);
assert.equal(recipe.width, Math.round((row.max[0] - row.min[0]) / 35));
assert.equal(recipe.height, Math.round((row.max[1] - row.min[1]) / 35));
const cells = receiverCells(recipe);
const registry = JSON.parse(
    await fs.readFile(base + "/registry-snapshot.json", "utf8"),
  ),
  file = path.join(import.meta.dirname, "receiver-frame-fits", code + ".json");
let receipt;
if (mode === "source") {
  const old = await fs.readFile(file).catch(() => null);
  if (old) {
    assert.ok(
      process.argv.includes("--force"),
      "Existing receiver evidence: review before --force",
    );
    const dir = base + "/receiver-fit-backups";
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(dir + "/" + code + "-" + hash(old) + ".json", old);
  }
  const refs = [];
  for (const name of (
    await fs.readdir(path.join(import.meta.dirname, "recess-frame-fits"))
  ).sort())
    if (name.endsWith(".json")) {
      const record = JSON.parse(
          await fs.readFile(
            path.join(import.meta.dirname, "recess-frame-fits", name),
            "utf8",
          ),
        ),
        r = JSON.parse(
          await fs.readFile(
            base + "/review/" + record.sourceCode + "/report.json",
            "utf8",
          ),
        );
      refs.push({
        profile: record.profile,
        definitionId: record.sourceCode,
        id: r.model.id,
        references: ["render", "lod", "shadow"].map((tier) => ({
          tier,
          sha256: r.model.assets[tier].sha256,
        })),
      });
    }
  receipt = {
    schemaVersion: 1,
    sourceCode: code,
    sourceSHA256: row.sourceSHA256,
    reference: S,
    nativeDatumMM: recipe.mountDepthMM,
    sourceTopMM: row.max[2],
    quantizationReserveMM: 0.02,
    profiles: [{ profile: S.name, references: [] }, ...refs],
    cells,
  };
} else receipt = JSON.parse(await fs.readFile(file, "utf8"));
assert.equal(receipt.sourceCode, code);
assert.equal(receipt.nativeDatumMM, recipe.mountDepthMM);
assert.deepEqual(receipt.reference, S);
assert.deepEqual(receipt.cells.map(({ seatsMM, ...c }) => c), cells.map(({ seatsMM, ...c }) => c));
const raw = await fs.readFile(path.join(root, "models", row.sourcePath));
assert.equal(hash(raw), receipt.sourceSHA256);
const n = raw.readUInt32LE(80),
  source = new Float32Array(n * 9);
for (let t = 0; t < n; t++)
  for (let k = 0; k < 9; k++)
    source[t * 9 + k] = raw.readFloatLE(84 + t * 50 + 12 + k * 4);
if (receipt.socketProbeVersion !== SOCKET_PROBE_VERSION) {
  receipt.socketProbes = sourceSocketProbes(source, row, cells);
  receipt.socketProbeVersion = SOCKET_PROBE_VERSION;
}
const profiles = [];
for (const p of receipt.profiles) {
  let lower;
  if (p.profile === S.name) {
    const V = [
        [S.bottomWidth * 17.5, 17 - S.depth * 35],
        [17.5, 17],
      ].flatMap(([r, z]) => [
        [-r, -r, z],
        [r, -r, z],
        [r, r, z],
        [-r, r, z],
      ]),
      F = [
        [0, 2, 1],
        [0, 3, 2],
      ];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      F.push([i, j, j + 4], [i, j + 4, i + 4]);
    }
    lower = Float32Array.from(F.flatMap((f) => f.flatMap((i) => V[i])));
  } else {
    const r = JSON.parse(
        await fs.readFile(
          base + "/review/" + p.definitionId + "/report.json",
          "utf8",
        ),
      ),
      live = registry.find((m) => m.id === p.id);
    const published = matchesPreparedPublication(r.model, live);
    if (!published) {
      assert.equal(
        p.definitionId,
        preparedInsertion,
        "Refresh insertion reference " + p.definitionId,
      );
      assert.equal(
        r.sourceSHA256,
        inv.find((v) => v.code === p.definitionId)?.sourceSHA256,
      );
      assert.equal(r.model.assets.source.sha256, r.sourceSHA256);
      assert.equal(r.model.mountProfile, recessProfileID(p.definitionId));
      assert.ok(
        r.optimization?.selection && r.mountStandard,
        "Select and standardize the prepared insertion before fitting",
      );
    }
    p.referenceStage = published ? "published" : "prepared";
    assert.equal(r.model.mountProfile, p.profile);
    p.sourceSHA256 = r.sourceSHA256;
    p.referenceMetadata = {
      mountDepth: r.model.mountDepth,
      width: r.model.width,
      height: r.model.height,
      placementOffset: r.model.placementOffset,
    };
    const all = [];
    for (const ref of p.references) {
      const bytes = await fs.readFile(
        base + "/review/" + p.definitionId + "/" + ref.tier + ".glb",
      );
      assert.equal(hash(bytes), ref.sha256);
      assert.equal(r.model.assets[ref.tier].sha256, ref.sha256);
      if (published) assert.equal(live.assets[ref.tier].sha256, ref.sha256);
      else if (ref.tier !== "shadow")
        await validateRecessMount(bytes, r.model, r.recessConstruction);
      const arr = triangles(
        await io.readBinary(bytes),
        17 - r.model.mountDepth * 35,
      );
      for (let i = 0; i < arr.length; i += 9) {
        const a = arr.subarray(i, i + 3),
          b = arr.subarray(i + 3, i + 6),
          c = arr.subarray(i + 6, i + 9),
          area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if (area < -1e-9 && Math.min(a[2], b[2], c[2]) < 17.001)
          all.push(...arr.subarray(i, i + 9));
      }
    }
    lower = Float32Array.from(all);
  }
  if (mode === "source") {
    p.lowerSurfaceSHA256 = hash(Buffer.from(lower.buffer));
    p.lowerTriangles = lower.length / 9;
  } else
    assert.equal(
      hash(Buffer.from(lower.buffer)),
      p.lowerSurfaceSHA256,
      "Insertion geometry differs from source fit",
    );
  profiles.push({ profile: p.profile, lower });
}
const datasets = [{ name: "source", arr: source }],
  directories =
    mode === "source"
      ? []
      : mode === "native"
        ? [
            base + "/review/" + code,
            base + "/review/" + code + "/candidates/compact",
          ]
        : [base + "/review/" + code],
  reports = [];
for (const [i, dir] of directories.entries()) {
  const r = JSON.parse(await fs.readFile(dir + "/report.json", "utf8"));
  assert.equal(r.model.sourceCode, code);
  assert.equal(r.model.width, recipe.width);
  assert.equal(r.model.height, recipe.height);
  if (mode === "final")
    assert.equal(r.model.mountDepth, receipt.nativeDatumMM ? S.depth : 0);
  else
    assert.ok(
      Math.abs(r.model.mountDepth - receipt.nativeDatumMM / 35) < 0.000002,
    );
  const assets = {};
  for (const tier of ["render", "lod", "shadow"]) {
    const bytes = await fs.readFile(dir + "/" + tier + ".glb");
    assets[tier] = hash(bytes);
    datasets.push({
      name:
        mode === "native" ? (i === 0 ? "balanced-" : "compact-") + tier : tier,
      arr: Float32Array.from(
        triangles(
          await io.readBinary(bytes),
          receipt.nativeDatumMM - r.model.mountDepth * 35,
        ),
      ),
    });
  }
  reports.push({ dir, r, assets });
}
const fits = [],
  cache = new Map();
for (const data of datasets) {
  const geometryHash = hash(Buffer.from(data.arr.buffer));
  let rows = cache.get(geometryHash);
  if (!rows) {
    rows = fitReceiverGeometry(data.arr, profiles, cells);
    cache.set(geometryHash, rows);
  }
  for (const row of rows)
    fits.push({
      ...row,
      receiverTier: data.name,
      receiverGeometrySHA256: geometryHash,
    });
  console.log(
    "MEDIEVAL_RECEIVER_DATASET",
    data.name,
    rows.length,
    Math.max(...rows.map((r) => r.verifiedSeatMM)),
  );
}
if (mode !== "final")
  for (const cell of receipt.cells)
    for (const p of profiles) {
      const rows = fits.filter(f => f.profile === p.profile && f.x === cell.x && f.y === cell.y);
      assert.ok(rows.length && rows.every(f => Number.isFinite(f.verifiedSeatMM)));
      cell.seatsMM[p.profile] = Math.max(...rows.map(f => f.verifiedSeatMM)) + receipt.quantizationReserveMM;
    }
if (mode === "source") {
  for (const p of receipt.profiles) {
    p.fits = fits.filter((f) => f.profile === p.profile);
    p.verifiedSeatMM = Math.max(...p.fits.map((f) => f.verifiedSeatMM));
  }
} else if (mode === "native") {
  for (const item of reports) {
    const bias = receipt.nativeDatumMM - item.r.model.mountDepth * 35;
    for (const slot of item.r.model.supportSlots) {
      const covered = receipt.cells.filter(c => receiverSlotForCell(item.r.model, c.x, c.y) === slot);
      for (const p of profiles) {
        const seat = Math.max(...covered.map(c => c.seatsMM[p.profile]));
        const rise =
          Math.ceil(
            ((seat - bias) / 35 - slot.elevation) * 1e6,
          ) / 1e6;
        assert.ok(rise >= 0 && rise <= 0.15);
        if (p.profile === S.name) slot.insertionRise = Math.max(slot.insertionRise ?? 0, rise);
        else (slot.insertionRises ??= {})[p.profile] = Math.max(slot.insertionRises?.[p.profile] ?? 0, rise);
      }
    }
    item.r.receiverNativeReview = {
      assets: item.assets,
      cases: fits.length,
      quantizationReserveMM: receipt.quantizationReserveMM,
    };
    await fs.writeFile(
      item.dir + "/report.json",
      JSON.stringify(item.r, null, 2) + "\n",
    );
  }
  receipt.nativeCandidateReview = {
    cases: fits,
    assets: reports.map((v) => v.assets),
  };
  delete receipt.final;
} else {
  const item = reports[0],
    bias = receipt.nativeDatumMM - item.r.model.mountDepth * 35;
  if (refreshSlots) refreshReceiverSupportSlots(item.r.model, receipt, fits);
  for (const fit of fits) {
    const slot = receiverSlotForCell(item.r.model, fit.x, fit.y);
    const rise =
      fit.profile === S.name
        ? slot.insertionRise
        : slot.insertionRises[fit.profile];
    fit.publishedSeatMM = slot.elevation * 35 + bias + rise * 35;
    assert.ok(
      fit.publishedSeatMM + 1e-6 >= fit.verifiedSeatMM,
      "Receiver intersects insertion " +
        fit.profile +
        " " +
        fit.receiverTier +
        " " +
        fit.rotation,
    );
  }
  receipt.final = {
    assets: item.assets,
    mountDepth: item.r.model.mountDepth,
    supportSlots: item.r.model.supportSlots,
    placementOffset: item.r.model.placementOffset,
    width: item.r.model.width,
    height: item.r.model.height,
    fits,
  };
  item.r.receiverFrameReview = {
    receipt: "receiver-frame-fits/" + code + ".json",
    assets: item.assets,
    cases: fits.length,
  };
  await fs.writeFile(
    item.dir + "/report.json",
    JSON.stringify(item.r, null, 2) + "\n",
  );
}
await fs.writeFile(file, JSON.stringify(receipt, null, 2) + "\n");
console.log("MEDIEVAL_RECEIVER_VERIFIED", mode, receipt.cells.map(c => ({ x: c.x, y: c.y, seatsMM: c.seatsMM })));
