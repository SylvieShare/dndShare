import { expect, it, vi } from "vitest";
import { createPerformanceBridge } from "./performanceBridge";
it("subscribes before renderer initialization and releases observation when the panel closes", () => {
  const bridge = createPerformanceBridge(),
    listener = vi.fn(),
    stop = vi.fn(),
    renderer = {
      observePerformance: vi.fn((fn) => {
        fn({ fps: 12 });
        return stop;
      }),
    };
  const close = bridge.observe(listener);
  bridge.attach(renderer);
  expect(listener).toHaveBeenCalledWith({ fps: 12 });
  close();
  expect(stop).toHaveBeenCalledTimes(1);
  bridge.destroy();
});
