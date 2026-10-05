import { expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { useCameraPan } from "./useCameraPan";
it("moves continuously by elapsed time and stops after release", () => {
  let callback,
    now = 0,
    view = {
      x: 0,
      y: 0,
      cellPixels: 100,
      rotation: 0,
      azimuth: 0,
      tilt: 90,
      fit: true,
    };
  vi.stubGlobal("requestAnimationFrame", (fn) => {
    callback = fn;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("performance", { now: () => now });
  const scope = effectScope(),
    pan = scope.run(() =>
      useCameraPan(
        () => view,
        (next) => {
          view = next;
        },
        () => true,
      ),
    );
  pan.down("ArrowRight");
  const samples = [];
  for (let i = 0; i < 12; i++) {
    now += 16;
    callback(now);
    samples.push(view.x);
  }
  expect(samples[1]).toBeGreaterThan(samples[0]);
  expect(samples[11]).toBeGreaterThan(samples[6]);
  expect(
    samples.every(
      (value, index) => !index || value - samples[index - 1] < 0.05,
    ),
  ).toBe(true);
  pan.up("ArrowRight");
  for (let i = 0; i < 30; i++) {
    now += 16;
    callback(now);
  }
  const settled = view.x;
  pan.stop();
  expect(view.fit).toBe(false);
  expect(settled).toBeGreaterThan(samples[11]);
  scope.stop();
  vi.unstubAllGlobals();
});
