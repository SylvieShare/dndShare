import { expect, it, vi } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
import { createMapFramePreview } from "./mapFramePreview";
function setup() {
  const camera = new OrthographicCamera(-5, 5, 4, -4, 0.1, 100);
  camera.position.z = 5;
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const ctx = { clearRect: vi.fn(), drawImage: vi.fn() },
    target = {
      clientWidth: 200,
      clientHeight: 150,
      width: 0,
      height: 0,
      getContext: () => ctx,
    };
  const changed = vi.fn(),
    invalidate = vi.fn(),
    preview = createMapFramePreview(camera, invalidate);
  const stop = preview.observe(target, "light", changed),
    source = { width: 1000, height: 800 };
  return { preview, target, source, ctx, changed, invalidate, stop };
}
it("copies the current framebuffer around the projected source and freezes that copy outside the viewport", () => {
  const { preview, source, ctx, changed, invalidate, stop } = setup();
  expect(invalidate).toHaveBeenCalledOnce();
  preview.copy(source, () => new Vector3());
  expect(ctx.drawImage).toHaveBeenCalledWith(
    source,
    340,
    280,
    320,
    240,
    0,
    0,
    200,
    150,
  );
  expect(changed.mock.lastCall[0]).toEqual({ state: "live", captured: true });
  preview.copy(source, () => new Vector3(20, 0, 0));
  expect(ctx.drawImage).toHaveBeenCalledOnce();
  expect(ctx.clearRect).toHaveBeenCalledOnce();
  expect(changed.mock.lastCall[0]).toEqual({
    state: "outside",
    captured: true,
  });
  stop();
  preview.copy(source, () => new Vector3());
  expect(ctx.drawImage).toHaveBeenCalledOnce();
  preview.destroy();
});
it("keeps the source at the centre even when its crop extends beyond the canvas edge", () => {
  const { preview, source, ctx } = setup();
  preview.copy(source, () => new Vector3(4.9, 0, 0));
  const [, sx, , sw, , dx, , dw] = ctx.drawImage.mock.lastCall;
  expect(((990 - sx) * dw) / sw + dx).toBeCloseTo(100);
  preview.destroy();
});
it("does not invent an image for a source that has never been visible and isolates capture errors", () => {
  const { preview, source, ctx, changed } = setup();
  preview.copy(source, () => new Vector3(20, 0, 0));
  expect(changed.mock.lastCall[0]).toEqual({
    state: "outside",
    captured: false,
  });
  expect(ctx.drawImage).not.toHaveBeenCalled();
  ctx.drawImage.mockImplementation(() => {
    throw new Error("copy failed");
  });
  expect(() => preview.copy(source, () => new Vector3())).not.toThrow();
  expect(changed.mock.lastCall[0]).toEqual({
    state: "unavailable",
    captured: false,
  });
  preview.destroy();
});
