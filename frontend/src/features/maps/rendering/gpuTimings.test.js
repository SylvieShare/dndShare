import { expect, it, vi } from "vitest";
import { createGpuTimings } from "./gpuTimings";

import { fakeGpu } from "./gpuTimings.fixture";

it("uses one query on ANGLE Metal even for hundreds of changing draw categories", () => {
  const { gpu, gl, queries } = fakeGpu(),
    originalExtension = gl.getExtension;
  gl.getExtension = (name) =>
    name === "WEBGL_debug_renderer_info"
      ? { UNMASKED_RENDERER_WEBGL: 123 }
      : originalExtension(name);
  gl.getParameter = (field) =>
    field === 123 ? "ANGLE Metal Renderer: Apple M2 Pro" : false;
  const render = gpu.render,
    draw = gpu.renderBufferDirect,
    accept = vi.fn();
  const timer = createGpuTimings(gpu, (object) => object.kind);
  timer.start();
  expect(timer.granularity).toBe("frame");
  expect(gpu.render).toBe(render);
  expect(gpu.renderBufferDirect).toBe(draw);
  timer.begin(accept);
  gpu.render({
    draws: Array.from({ length: 300 }, (_, i) => ({
      object: { kind: i % 2 ? "objects" : "overlays" },
    })),
  });
  timer.end();
  expect(queries).toHaveLength(1);
  queries[0].ready = true;
  timer.poll();
  expect(accept).toHaveBeenCalledWith({ frame: 1 });
  timer.stop();
  expect(queries[0].deleted).toBe(true);
});

it("attributes MSAA resolves to frame output rather than the last mesh, and keeps mask resolves in outlines", () => {
  const { gpu, gl, queries } = fakeGpu(),
    accept = vi.fn();
  const blit = (gl.blitFramebuffer = vi.fn()),
    original = gpu.render;
  gpu.render = function (scene) {
    original.call(this, scene);
    gl.blitFramebuffer();
  };
  const timer = createGpuTimings(gpu, (o) => o.kind);
  timer.start();
  timer.begin(accept);
  gpu.render({ draws: [{ object: { kind: "effects" } }] });
  gpu.render({
    userData: { renderCategory: "outline" },
    draws: [{ object: { kind: "outline" } }],
  });
  timer.end();
  queries.forEach((q) => (q.ready = true));
  timer.poll();
  expect(accept).toHaveBeenCalledWith({
    other: 1,
    effects: 1,
    presentation: 1,
    outline: 1,
  });
  timer.stop();
  expect(gl.blitFramebuffer).toBe(blit);
});

it("coalesces draw categories, waits asynchronously and restores renderer methods", () => {
  const { gpu, queries } = fakeGpu(),
    render = gpu.render,
    draw = gpu.renderBufferDirect,
    accept = vi.fn(),
    timer = createGpuTimings(gpu, (object, material) =>
      material.isMeshDepthMaterial ? "shadows" : object.kind,
    );
  timer.start();
  timer.begin(accept);
  gpu.render({
    draws: [
      { object: { kind: "tiles" } },
      { object: { kind: "tiles" } },
      { object: { kind: "objects" } },
      { object: {}, material: { isMeshDepthMaterial: true } },
    ],
  });
  timer.end();
  timer.poll();
  expect(accept).not.toHaveBeenCalled();
  expect(queries).toHaveLength(4);
  queries.forEach((q) => {
    q.ready = true;
  });
  timer.poll();
  expect(accept).toHaveBeenCalledWith({
    other: 1,
    tiles: 1,
    objects: 1,
    shadows: 1,
  });
  timer.stop();
  expect(gpu.render).toBe(render);
  expect(gpu.renderBufferDirect).toBe(draw);
  expect(queries.every((q) => q.deleted)).toBe(true);
});
it("discards disjoint measurements and bounds query overhead", () => {
  const { gpu, gl, queries } = fakeGpu(),
    accept = vi.fn(),
    timer = createGpuTimings(gpu, (o) => o.kind);
  timer.start();
  timer.begin(accept);
  gpu.render({ draws: [{ object: { kind: "tiles" } }] });
  timer.end();
  gl.disjoint = true;
  timer.poll();
  expect(accept).not.toHaveBeenCalled();
  expect(queries.every((q) => q.deleted)).toBe(true);
  gl.disjoint = false;
  const before = queries.length;
  timer.begin(accept);
  gpu.render({
    draws: Array.from({ length: 150 }, (_, i) => ({
      object: { kind: `category-${i}` },
    })),
  });
  timer.end();
  expect(queries.length - before).toBe(96);
  expect(queries.every((q) => q.deleted)).toBe(true);
  timer.stop();
});
