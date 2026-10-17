import { expect, it, vi } from "vitest";
import { BoxGeometry, Matrix4, MeshStandardMaterial } from "three";
import { createMapAreaPreview } from "./mapAreaPreview";
it("renders only area members from shared assets, reuses an unchanged image, flips GPU rows, and restores renderer state on errors", () => {
  vi.stubGlobal("devicePixelRatio", 1);
  const geometry = new BoxGeometry(),
    material = new MeshStandardMaterial();
  const assets = {
    metadata: () => ({ width: 1, height: 1 }),
    signature: (ids) => [...ids].join(),
    model: vi.fn(() => ({
      parts: [{ geometry, material, matrix: new Matrix4() }],
    })),
  };
  const previous = {},
    gpu = {
      shadowMap: { enabled: true },
      getRenderTarget: () => previous,
      setRenderTarget: vi.fn(),
      render: vi.fn(),
      readRenderTargetPixels: vi.fn((_, x, y, w, h, pixels) => {
        pixels.fill(255);
        pixels[0] = 10;
        pixels[(h - 1) * w * 4] = 200;
      }),
    };
  const ctx = {
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: vi.fn(),
    },
    canvas = { clientWidth: 200, clientHeight: 150, getContext: () => ctx },
    changed = vi.fn(),
    preview = createMapAreaPreview(gpu, assets, vi.fn());
  const d = {
    areas: [{ id: "a", tileIds: ["floor"], objectIds: [] }],
    objects: [],
  };
  const tiles = [
    { id: "floor", modelId: "model", x: 0, y: 0, rotation: 0 },
    { id: "outside", modelId: "other", x: 10, y: 10, rotation: 0 },
  ];
  preview.update(d, tiles, [], "render");
  const stop = preview.observe(canvas, "a", changed);
  expect(changed).toHaveBeenLastCalledWith("ready");
  expect(assets.model.mock.calls.every(([id]) => id === "model")).toBe(true);
  expect(ctx.putImageData.mock.lastCall[0].data[0]).toBe(200);
  expect(gpu.setRenderTarget).toHaveBeenLastCalledWith(previous);
  expect(gpu.shadowMap.enabled).toBe(true);
  preview.update(d, tiles, [], "render");
  expect(gpu.render).toHaveBeenCalledOnce();
  gpu.readRenderTargetPixels.mockImplementation(() => {
    throw new Error("lost context");
  });
  preview.update(d, [{ ...tiles[0], x: 1 }], [], "render");
  expect(changed).toHaveBeenLastCalledWith("unavailable");
  expect(gpu.setRenderTarget).toHaveBeenLastCalledWith(previous);
  expect(gpu.shadowMap.enabled).toBe(true);
  stop();
  preview.destroy();
  geometry.dispose();
  material.dispose();
  vi.unstubAllGlobals();
});
