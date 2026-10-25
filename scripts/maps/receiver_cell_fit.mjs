import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { nativeSeatSupport } from "./native_seat_support.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { BufferGeometry, BufferAttribute } = require("three"), { MeshBVH } = require("three-mesh-bvh");

export function fitReceiverGeometry(frame, profiles, cells, datum = 17) {
  const flat = frame.map((v, i) => i % 3 === 2 ? 0 : v), geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(flat, 3));
  try {
    const tree = new MeshBVH(geometry), rows = [];
    for (const p of profiles)
      for (const angle of [0, 90, 180, 270]) {
        const a = angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), body = p.lower.slice();
        for (let i = 0; i < body.length; i += 3) {
          const x = body[i], y = body[i + 1];
          body[i] = x * c - y * s;
          body[i + 1] = x * s + y * c;
        }
        for (const cell of cells) {
          const result = nativeSeatSupport(body, frame, geometry, tree, ...cell.centerMM, datum);
          assert.ok(Number.isFinite(result.minimumSeatMM) && result.overlaps > 0, "No measured receiving contact");
          rows.push({ x: cell.x, y: cell.y, profile: p.profile, rotation: angle, ...result });
        }
      }
    return rows;
  } finally {
    geometry.dispose();
  }
}
