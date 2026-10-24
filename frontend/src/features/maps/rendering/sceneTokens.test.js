import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  BoxGeometry,
  ImageLoader,
  Matrix4,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { buildMapToken, createTokenPortraits } from "./sceneTokens";
import { applyAreaOpacity } from "./areaOpacity";
import { disposeObjects } from "./sceneObjects";
import { createSceneObjectLayer } from "./sceneObjectLayer";

let loads, draws;
beforeEach(() => {
  loads = [];
  draws = [];
  vi.stubGlobal("document", {
    createElement: () => ({
      getContext: () => ({
        fillRect() {},
        strokeText() {},
        fillText() {},
        drawImage: (...args) => draws.push(args),
      }),
    }),
  });
  vi.spyOn(ImageLoader.prototype, "load").mockImplementation((url, onLoad) => {
    loads.push({ url, onLoad });
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const creature = {
  id: "ogre",
  kind: "creature",
  imageUrl: "/api/svg/12",
  color: "#c18f6f",
  name: "Огр",
  x: 1,
  y: 2,
  size: 1,
};
const fog = { material: (m) => m };

it("shares portraits across rebuilds and releases removed and late-loading images", () => {
  const invalidate = vi.fn(),
    portraits = createTokenPortraits(invalidate);
  const texture = portraits.texture(creature),
    dispose = vi.spyOn(texture, "dispose");
  const first = buildMapToken(creature, { tokenPortraits: portraits }, fog);
  disposeObjects(first);
  expect(dispose).not.toHaveBeenCalled();
  const second = buildMapToken(creature, { tokenPortraits: portraits }, fog);
  expect(loads).toHaveLength(1);
  expect(second.children[1].material.map).toBe(texture);
  portraits.retain([]);
  expect(dispose).toHaveBeenCalledOnce();
  loads[0].onLoad({ width: 512, height: 256 });
  expect(invalidate).not.toHaveBeenCalled();
  expect(draws).toHaveLength(0);
  disposeObjects(second);
  portraits.destroy();
  expect(dispose).toHaveBeenCalledOnce();
});
it("puts the icon on the cap and preserves hidden-area opacity after asynchronous loading", () => {
  const invalidate = vi.fn(),
    portraits = createTokenPortraits(invalidate);
  const root = buildMapToken(
    { ...creature, hidden: true },
    { tokenPortraits: portraits },
    fog,
  );
  applyAreaOpacity(root, 0.2);
  const cap = root.children[1];
  root.updateMatrixWorld(true);
  const normal = new Vector3(0, 0, 1).transformDirection(cap.matrixWorld);
  expect(normal.y).toBeCloseTo(1);
  expect(cap.position.y).toBeGreaterThan(0.04);
  expect(cap.material.opacity).toBeCloseTo(0.08);
  expect(cap.material.toneMapped).toBe(false);
  loads[0].onLoad({ width: 512, height: 256 });
  expect(draws[0].slice(1)).toEqual([10, 69, 236, 118]);
  expect(cap.material.opacity).toBeCloseTo(0.08);
  expect(invalidate).toHaveBeenCalledOnce();
  disposeObjects(root);
  portraits.destroy();
});
it("crops a player's portrait to the round face without stretching", () => {
  const portraits = createTokenPortraits();
  portraits.texture({ ...creature, kind: "player" });
  loads[0].onLoad({ width: 128, height: 256 });
  expect(draws[0].slice(1)).toEqual([0, -128, 256, 512]);
  portraits.destroy();
});

it("uses a shared miniature with token sizing, fog opacity and safe disposal", () => {
  const geometry = new BoxGeometry(),
    material = new MeshStandardMaterial();
  const dispose = vi.spyOn(geometry, "dispose");
  const metadata = { id: "kobold", itemIds: [1635], maxHeight: 0.91 };
  const resource = { parts: [{ geometry, material, matrix: new Matrix4() }] };
  const assets = {
    catalogue: () => [metadata],
    metadata: () => metadata,
    model: () => resource,
  };
  const root = buildMapToken(
    { ...creature, itemId: 1635, size: 2, hidden: true },
    { assets, tier: "render" },
    fog,
  );
  const mini = root.children[1];
  expect(mini.scale.x).toBe(2);
  expect(mini.children[0].geometry).toBe(geometry);
  expect(mini.children[0].receiveShadow).toBe(true);
  expect(root.children[2].position.y).toBeGreaterThan(1.8);
  applyAreaOpacity(root, 0.2);
  expect(mini.children[0].material.opacity).toBeCloseTo(0.08);
  disposeObjects(root);
  expect(dispose).not.toHaveBeenCalled();
  expect(material.opacity).toBe(1);
});

it("replaces the portrait when a miniature finishes loading, without a token edit", () => {
  let ready = null;
  const metadata = { id: "kobold", itemIds: [1635], maxHeight: 1 };
  const assets = {
    catalogue: () => [metadata],
    metadata: () => metadata,
    model: () => ready,
  };
  const portraits = createTokenPortraits(),
    layer = createSceneObjectLayer(assets, fog, portraits);
  const d = { objects: [], zones: [], areas: [], width: 4, height: 4 },
    state = { tokens: [{ ...creature, itemId: 1635 }] };
  const appearance = { tokenOpacity: () => 1 };
  layer.update(d, state, { master: true }, "render", appearance);
  expect(layer.root.children[0].children[1].isMesh).toBe(true);
  ready = {
    parts: [
      {
        geometry: new BoxGeometry(),
        material: new MeshStandardMaterial(),
        matrix: new Matrix4(),
      },
    ],
  };
  layer.update(d, state, { master: true }, "render", appearance);
  expect(layer.root.children[0].children[1].isGroup).toBe(true);
  layer.destroy();
  portraits.destroy();
});

it("preserves native part transforms when freezing a miniature on the board", () => {
  const geometry = new BoxGeometry(),
    material = new MeshStandardMaterial(),
    metadata = { id: "kobold", itemIds: [1635], maxHeight: 0.92 };
  const body = new Matrix4().makeTranslation(0.005, 0.485, -0.053),
    pebble = new Matrix4()
      .makeRotationY(0.4)
      .scale(new Vector3(0.041, 0.013, 0.028))
      .setPosition(0.348, 0.068, -0.035);
  const assets = {
    catalogue: () => [metadata],
    metadata: () => metadata,
    model: () => ({
      parts: [body, pebble].map((matrix) => ({ geometry, material, matrix })),
    }),
  };
  const portraits = createTokenPortraits(),
    layer = createSceneObjectLayer(assets, fog, portraits);
  const token = { ...creature, itemId: 1635, size: 2, elevation: 0.3 };
  layer.update(
    { objects: [], zones: [], areas: [], width: 4, height: 4 },
    { tokens: [token] },
    { master: true },
    "render",
    { tokenOpacity: () => 1 },
  );
  const mini = layer.root.children[0].children[1];
  const placement = new Matrix4()
    .makeScale(2, 2, 2)
    .setPosition(token.x, token.elevation, token.y);
  for (const [index, expected] of [body, pebble].entries()) {
    expect(mini.children[index].matrix.equals(expected)).toBe(true);
    expect(
      mini.children[index].matrixWorld.equals(
        placement.clone().multiply(expected),
      ),
    ).toBe(true);
    expect(mini.children[index].matrixAutoUpdate).toBe(false);
  }
  layer.destroy();
  portraits.destroy();
  geometry.dispose();
  material.dispose();
});
