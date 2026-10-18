import { expect, it } from "vitest";
import { createPerformanceHistory } from "./performanceHistory";
it("distinguishes rendered work from idle time and bounds a sparse 30 second history", () => {
  let time = 0;
  const history = createPerformanceHistory(() => time);
  time = 100;
  const accept = history.frame(
    { tiles: 2, draw: 3 },
    { calls: 5, triangles: 100 },
  );
  accept({ tiles: 4, shadows: 2 });
  time = 500;
  expect(history.snapshot(true).cpu).toEqual({ tiles: 2, draw: 3 });
  expect(history.snapshot(true).fps).toBe(2);
  time = 2000;
  const s = history.snapshot(true);
  expect(s.idle).toBe(true);
  expect(s.fps).toBe(0);
  expect(s.cpu).toEqual({ tiles: 2, draw: 3 });
  expect(s.gpu).toEqual({ tiles: 4, shadows: 2 });
  expect(s.history).toHaveLength(60);
  time = 40000;
  expect(history.snapshot(true).history.every((b) => b.cpu === null)).toBe(
    true,
  );
  expect(history.snapshot(true).cpu).toEqual({ tiles: 2, draw: 3 });
  expect(history.snapshot(true).gpu).toEqual({ tiles: 4, shadows: 2 });
});
