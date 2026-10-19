import { expect, it, vi } from "vitest";
import { Scene, SRGBColorSpace } from "three";
import { createSceneFrame } from "./sceneFrame";

function setup() {
  const properties = new WeakMap();
  const gpu = {
    properties: {
      get(target) {
        if (!properties.has(target)) properties.set(target, {});
        return properties.get(target);
      },
    },
    outputColorSpace: SRGBColorSpace,
    autoClear: true,
    extensions: { has: () => true },
    getDrawingBufferSize: (v) => v.set(800, 600),
    setRenderTarget: vi.fn(),
    setClearColor: vi.fn(),
    clear: vi.fn(),
    render: vi.fn(),
  };
  return { gpu, frame: createSceneFrame(gpu) };
}

it("reuses the exact world depth for a scissored mask and restores state even on failure", () => {
  const { gpu, frame } = setup(),
    target = frame.prepare();
  const region = { x: 100, y: 80, width: 200, height: 180 };
  const scissor = target.scissor.clone();
  gpu.render.mockImplementation(() => {
    expect(gpu.autoClear).toBe(false);
    expect(target.scissorTest).toBe(true);
    expect(target.scissor.toArray()).toEqual([100, 80, 200, 180]);
    expect(target.isXRRenderTarget).toBe(false);
  });
  expect(frame.mask(new Scene(), {}, region)).toBe(target.texture);
  expect(gpu.clear).toHaveBeenCalledWith(true, false, false);
  expect(target.samples).toBe(4);
  expect(target.storeMultisampledDepthBuffer).toBe(true);
  expect(gpu.properties.get(target).__useRenderToTexture).toBe(false);
  expect(gpu.autoClear).toBe(true);
  expect(target.scissor.equals(scissor)).toBe(true);
  expect(target.scissorTest).toBe(false);
  expect(target.isXRRenderTarget).toBe(true);
  const restoredProperties = {};
  gpu.properties.get = () => restoredProperties;
  frame.prepare();
  expect(restoredProperties.__useRenderToTexture).toBe(false);
  gpu.render.mockImplementation(() => {
    throw new Error("draw failed");
  });
  expect(() => frame.mask(new Scene(), {}, region)).toThrow("draw failed");
  expect(gpu.autoClear).toBe(true);
  expect(target.scissor.equals(scissor)).toBe(true);
  expect(target.isXRRenderTarget).toBe(true);
  frame.destroy();
});

it("shares the HDR frame with fog and releases replaced targets", () => {
  const { frame } = setup(),
    display = frame.prepare();
  const disposed = vi.fn();
  display.addEventListener("dispose", disposed);
  expect(display.texture.colorSpace).toBe(SRGBColorSpace);
  expect(frame.prepare()).toBe(display);
  const hdr = frame.prepare(true);
  expect(disposed).toHaveBeenCalledOnce();
  expect(hdr.isXRRenderTarget).toBe(false);
  expect(hdr.depthTexture.isDepthTexture).toBe(true);
  expect(hdr.resolveDepthBuffer).toBe(true);
  expect(frame.prepare(true)).toBe(hdr);
  frame.destroy();
});
