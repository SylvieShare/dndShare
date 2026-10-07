import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useMapCanvasPointer } from "./useMapCanvasPointer";
const hooks = vi.hoisted(() => ({ cleanup: [] }));
vi.mock("vue", () => ({
  onMounted: (fn) => fn(),
  onBeforeUnmount: (fn) => hooks.cleanup.push(fn),
}));
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});
afterEach(() => {
  hooks.cleanup.splice(0).forEach((fn) => fn());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function setup(
  hit = { tileId: "tile", point: { x: 2, y: 3, elevation: 0.4 } },
  extra = {},
) {
  const host = {
    value: {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        right: 200,
        bottom: 200,
      }),
      focus: vi.fn(),
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    },
  };
  const emit = vi.fn(),
    setView = vi.fn();
  const renderer = {
    pick: () => hit,
    world: (e) => ({ x: e.clientX / 10, y: e.clientY / 10 }),
    getView: () => ({ x: 0, y: 0, azimuth: 0, tilt: 45 }),
  };
  const pointer = useMapCanvasPointer(
    host,
    { tool: "select", document: { kind: "tiles" }, holdToDrag: true, ...extra },
    () => renderer,
    emit,
    setView,
  );
  const event = { pointerId: 1, button: 0, clientX: 20, clientY: 30 };
  return { pointer, event, emit, setView };
}
it("a quick drag over a model pans, cancels the hold and never starts an edit", () => {
  const { pointer, event, emit, setView } = setup();
  pointer.down(event);
  pointer.move({ ...event, clientX: 40 });
  vi.advanceTimersByTime(600);
  pointer.up({ ...event, clientX: 40 });
  expect(setView).toHaveBeenCalled();
  expect(emit).not.toHaveBeenCalled();
});
it("holding starts and lifts the element at 500 ms before any movement", () => {
  const { pointer, event, emit, setView } = setup();
  pointer.down(event);
  vi.advanceTimersByTime(499);
  expect(emit).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(emit.mock.calls.map((c) => c[1].phase)).toEqual(["start", "hold"]);
  pointer.move({ ...event, clientX: 40 });
  pointer.up({ ...event, clientX: 40 });
  expect(emit.mock.calls.map((c) => c[1].phase)).toEqual([
    "start",
    "hold",
    "move",
    "end",
  ]);
  expect(setView).not.toHaveBeenCalled();
});
it("a quick click selects, while release and cancellation prevent a late hold", () => {
  const { pointer, event, emit } = setup();
  pointer.down(event);
  pointer.up(event);
  vi.advanceTimersByTime(600);
  expect(emit.mock.calls.map((c) => c[1].phase)).toEqual(["start", "end"]);
  emit.mockClear();
  pointer.down(event);
  pointer.cancel(event);
  vi.advanceTimersByTime(600);
  expect(emit).not.toHaveBeenCalled();
});
it("empty space always pans and command selection keeps its immediate gesture", () => {
  const empty = setup(null);
  empty.pointer.down(empty.event);
  vi.advanceTimersByTime(600);
  empty.pointer.move({ ...empty.event, clientX: 40 });
  empty.pointer.up({ ...empty.event, clientX: 40 });
  expect(empty.setView).toHaveBeenCalled();
  expect(empty.emit).not.toHaveBeenCalled();
  const command = setup();
  command.pointer.down({ ...command.event, metaKey: true });
  expect(command.emit.mock.calls[0][1].phase).toBe("start");
  vi.advanceTimersByTime(600);
  expect(command.emit).toHaveBeenCalledTimes(1);
});
it("session canvas retains immediate token dragging", () => {
  const { pointer, event, emit } = setup(
    { tokenId: "token" },
    { holdToDrag: false },
  );
  pointer.down(event);
  expect(emit.mock.calls[0][1].phase).toBe("start");
});
