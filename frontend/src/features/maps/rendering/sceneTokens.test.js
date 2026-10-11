import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ImageLoader, Vector3 } from "three";
import { buildMapToken, createTokenPortraits } from "./sceneTokens";
import { applyAreaOpacity } from "./areaOpacity";
import { disposeObjects } from "./sceneObjects";

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
