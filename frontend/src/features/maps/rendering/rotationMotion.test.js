import { expect, it } from "vitest";
import { createRotationMotion } from "./rotationMotion";
import { createTileLayer } from "./tileLayer";
import { BoxGeometry, MeshStandardMaterial, Matrix4, Vector3 } from "three";

it("keeps a rotating group's distance and pivot through intermediate frames", () => {
  const motion = createRotationMotion();
  motion.set("a", { x: 1, y: 0, rotation: 0, elevation: 0 });
  motion.set("b", { x: 3, y: 0, rotation: 0, elevation: 0 });
  motion.set("a", { x: 0, y: 1, rotation: 90, elevation: 0 });
  motion.set("b", { x: 0, y: 3, rotation: 90, elevation: 0 });
  expect(motion.advance(60)).toBe(true);
  const a = motion.pose("a"),
    b = motion.pose("b");
  expect(a.rotation).toBeGreaterThan(0);
  expect(a.rotation).toBeLessThan(90);
  expect(Math.hypot(a.x, a.y)).toBeCloseTo(1);
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(2);
  expect(motion.advance(280)).toBe(false);
  expect(motion.pose("a")).toMatchObject({ x: 0, y: 1, rotation: 90 });
});

it("continues clockwise across 360 degrees and repeated R without restarting at an old angle", () => {
  const motion = createRotationMotion(),
    pose = { x: 2, y: 3, elevation: 0.4 };
  motion.set("chest", { ...pose, rotation: 270 });
  motion.set("chest", { ...pose, rotation: 0 });
  motion.advance(40);
  const before = motion.pose("chest").rotation;
  expect(before).toBeGreaterThan(270);
  expect(before).toBeLessThan(360);
  motion.set("chest", { ...pose, rotation: 90 });
  expect(motion.pose("chest").rotation).toBe(before);
  motion.advance(40);
  expect(motion.pose("chest").rotation).toBeGreaterThan(before);
  motion.advance(280);
  expect(motion.pose("chest").rotation).toBe(450);
  for (let i = 6; i < 20; i++) {
    motion.set("chest", { ...pose, rotation: (i * 90) % 360 });
    motion.advance(280);
    expect(motion.pose("chest").rotation).toBe(i * 90);
  }
});

it("writes an intermediate angle into the actual tile instance while preserving the saved tile", () => {
  const geometry = new BoxGeometry(),
    material = new MeshStandardMaterial();
  const layer = createTileLayer(
    {
      metadata: () => ({ width: 1, height: 1 }),
      model: () => ({ parts: [{ geometry, material, matrix: new Matrix4() }] }),
    },
    { material: (m) => m },
  );
  const tile = {
    id: "floor",
    modelId: "model",
    x: 2,
    y: 2,
    rotation: 0,
    elevation: 0,
  };
  layer.rebuild([tile], "render", []);
  tile.rotation = 90;
  layer.rebuild([tile], "render", []);
  layer.advance(50);
  const matrix = new Matrix4();
  layer.root.children[0].getMatrixAt(0, matrix);
  const forward = new Vector3(1, 0, 0).transformDirection(matrix);
  expect(forward.x).toBeGreaterThan(0);
  expect(forward.z).toBeGreaterThan(0);
  expect(tile.rotation).toBe(90);
  layer.advance(280);
  layer.root.children[0].getMatrixAt(0, matrix);
  expect(new Vector3(1, 0, 0).transformDirection(matrix).z).toBeCloseTo(1);
  layer.destroy();
  geometry.dispose();
  material.dispose();
});
it("squeezes and unfolds a reflection without restarting on repeated preview updates", () => {
  const motion = createRotationMotion();
  const tile = { x: 2, y: 3, elevation: 0, rotation: 90 };
  motion.set("a", tile);
  const target = { ...tile, rotation: 270, mirrored: true };
  motion.set("a", target);
  motion.advance(30);
  expect(motion.pose("a").mirrorScale).toBeLessThan(1);
  for (let n = 0; n < 12; n++) {
    motion.set("a", target);
    motion.advance(30);
  }
  expect(motion.isMoving()).toBe(false);
  expect(motion.pose("a")).toMatchObject({ mirrored: true, mirrorScale: 1 });
  motion.set("a", tile);
  motion.advance(280);
  expect(motion.pose("a").mirrored).toBe(false);
});

it("finishes reflection immediately for reduced motion", () => {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    const m = createRotationMotion();
    m.set("a", { x: 0, y: 0, rotation: 0 });
    m.set("a", { x: 0, y: 0, rotation: 0, mirrored: true });
    expect(m.advance(16)).toBe(false);
    expect(m.pose("a").mirrored).toBe(true);
    expect(m.pose("a").mirrorScale).toBe(1);
  } finally {
    globalThis.matchMedia = original;
  }
});
