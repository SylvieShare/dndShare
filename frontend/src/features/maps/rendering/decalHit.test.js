import { afterEach, expect, it, vi } from "vitest";
import { Texture, Vector2 } from "three";
import { visibleDecalPixel } from "./decalHit";
afterEach(() => vi.unstubAllGlobals());
it("picks visible paint through its alpha mask and caches a small CPU image", () => {
  const pixels = new Uint8ClampedArray(16);
  pixels[7] = 255;
  const drawImage = vi.fn(),
    ctx = { drawImage, getImageData: () => ({ data: pixels }) };
  vi.stubGlobal("document", {
    createElement: () => ({ getContext: () => ctx }),
  });
  const texture = new Texture({ width: 2, height: 2 });
  const hit = {
    object: { material: { map: texture } },
    uv: new Vector2(0.1, 0.9),
  };
  expect(visibleDecalPixel(hit)).toBe(false);
  hit.uv.set(0.9, 0.9);
  expect(visibleDecalPixel(hit)).toBe(true);
  hit.uv.set(0.9, 0.1);
  expect(visibleDecalPixel(hit)).toBe(false);
  expect(drawImage).toHaveBeenCalledOnce();
});
