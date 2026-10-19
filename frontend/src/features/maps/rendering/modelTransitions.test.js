import { afterEach, expect, it, vi } from "vitest";
import { BoxGeometry, Matrix4, MeshStandardMaterial } from "three";
import { createModelTransitions } from "./modelTransitions";
import { createTileLayer } from "./tileLayer";
afterEach(() => vi.unstubAllGlobals());
const tiles = () => [
  { id: "changed", modelId: "a", x: 1, y: 1, rotation: 0, level: 0 },
  { id: "neighbour", modelId: "b", x: 2, y: 1, rotation: 0, level: 0 },
];
const base = {
  tileFlash: () => 1,
  tileGroup: () => "room",
  tileOpacity: () => 1,
};
it("waits for replacement geometry, flashes only its instance and merges the batch again", () => {
  const done = vi.fn(),
    motion = createModelTransitions(done),
    document = tiles();
  motion.sync(document);
  motion.ready(() => true);
  expect(motion.groups()).toEqual([]);
  document[0].modelId = "b";
  motion.sync(document);
  motion.ready(() => false);
  motion.advance(600);
  expect(motion.flash("changed")).toBe(1);
  motion.ready(() => true);
  motion.advance(240);
  const appearance = motion.appearance(base);
  expect(appearance.tileFlash("changed")).toBeCloseTo(2.25);
  expect(appearance.tileFlash("neighbour")).toBe(1);
  const geometry = new BoxGeometry(1, 0.2, 1),
    material = new MeshStandardMaterial();
  const layer = createTileLayer(
    {
      metadata: () => ({ width: 1, height: 1 }),
      model: () => ({ parts: [{ geometry, material, matrix: new Matrix4() }] }),
    },
    { material: (m) => m },
  );
  const rebuild = () =>
    layer.rebuild(
      document,
      "render",
      [],
      appearance.tileOpacity,
      appearance.tileGroup,
    );
  rebuild();
  layer.applyAppearance(appearance);
  expect(layer.root.children).toHaveLength(2);
  for (const mesh of layer.root.children) {
    const shader = {
      uniforms: {},
      fragmentShader: "#include <common>\n#include <opaque_fragment>",
    };
    mesh.material.onBeforeCompile(shader, {});
    expect(shader.uniforms.mapAreaFlash.value).toBe(
      mesh.userData.tiles[0].id === "changed" ? 1.25 : 0,
    );
  }
  motion.advance(240);
  layer.applyAppearance(appearance);
  expect(motion.groups()).toEqual([]);
  expect(done).toHaveBeenCalledOnce();
  rebuild();
  expect(layer.root.children).toHaveLength(1);
  expect(layer.root.children[0].count).toBe(2);
  layer.destroy();
  geometry.dispose();
  material.dispose();
});
it("does not replay on LOD, catalogue or pose changes, and discards obsolete pending targets", () => {
  const motion = createModelTransitions(),
    document = tiles();
  motion.sync(document);
  document[0].x = 4;
  document[0].rotation = 90;
  motion.sync(document);
  motion.ready(() => true);
  expect(motion.groups()).toEqual([]);
  document[0].modelId = "b";
  motion.sync(document);
  document[0].modelId = "c";
  motion.sync(document);
  motion.ready((id) => id === "b");
  expect(motion.groups()).toEqual([]);
  motion.ready(() => true);
  motion.advance(480);
  motion.sync(document);
  motion.ready(() => true);
  expect(motion.groups()).toEqual([]);
  document[0].modelId = "d";
  motion.sync(document);
  motion.sync([document[1]]);
  motion.ready(() => true);
  expect(motion.groups()).toEqual([]);
});
it("keeps snapshots static and honours reduced motion even halfway through a pulse", () => {
  const motion = createModelTransitions(),
    document = tiles();
  motion.sync(document);
  document[0].modelId = "b";
  motion.sync(document, { animate: false });
  motion.ready(() => true);
  expect(motion.groups()).toEqual([]);
  document[0].modelId = "c";
  motion.sync(document);
  motion.ready(() => true);
  motion.advance(120);
  expect(motion.flash("changed")).toBeGreaterThan(1);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  motion.advance(16);
  expect(motion.flash("changed")).toBe(1);
  expect(motion.groups()).toEqual([]);
  document[0].modelId = "d";
  motion.sync(document);
  motion.ready(() => true);
  expect(motion.groups()).toEqual([]);
});
