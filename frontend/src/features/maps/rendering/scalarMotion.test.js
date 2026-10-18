import { it, expect, vi } from "vitest";
import { createScalarMotion } from "./scalarMotion";
import { createAreaTransitions } from "./areaTransitions";
import { areaAppearance } from "../lib/mapAreas";
it("retargets from the current intensity and finishes without a jump or residual flash", () => {
  const done = vi.fn(),
    m = createScalarMotion(done);
  m.set("light", 1);
  m.set("light", 0);
  m.advance(200);
  expect(m.value("light")).toBeCloseTo(0.5);
  expect(m.flash("light")).toBeGreaterThan(1);
  m.set("light", 1);
  expect(m.value("light")).toBeCloseTo(0.5);
  m.advance(100);
  expect(m.value("light")).toBeGreaterThan(0.5);
  m.advance(400);
  expect(m.value("light")).toBe(1);
  expect(m.flash("light")).toBe(1);
  expect(done).toHaveBeenCalledOnce();
});
it("fades area models, attached objects, fog and light together while interaction follows the saved flags", () => {
  const d = {
    areas: [
      { id: "a", hidden: false, fog: false, tileIds: ["t"], objectIds: ["o"] },
    ],
    objects: [{ id: "o", placement: { tileId: "t" } }],
  };
  const m = createAreaTransitions();
  m.sync(d);
  d.areas[0].hidden = true;
  m.sync(d);
  const view = areaAppearance(d, "hide", m);
  expect(view.hiddenTiles.has("t")).toBe(true);
  expect(view.tileOpacity("t")).toBe(1);
  m.advance(240);
  expect(view.tileOpacity("t")).toBeCloseTo(0.5);
  expect(view.tileFlash("t")).toBeGreaterThan(1);
  m.advance(240);
  expect(view.tileOpacity("t")).toBe(0);
  expect(view.tileFlash("t")).toBe(1);
  d.areas[0].hidden = false;
  d.areas[0].fog = true;
  m.sync(d);
  m.advance(340);
  expect(view.objectOpacity("o")).toBeGreaterThan(0);
  expect(view.objectOpacity("o")).toBeLessThan(1);
  expect(view.lightOpacity({ anchor: { kind: "object", id: "o" } })).toBe(
    view.objectOpacity("o"),
  );
  m.sync(d, { animate: false });
  expect(view.objectOpacity("o")).toBe(0);
  expect(m.fog("a")).toBe(1);
});
it("respects reduced motion immediately", () => {
  const d = {
      areas: [
        { id: "a", hidden: false, fog: false, tileIds: [], objectIds: [] },
      ],
    },
    m = createAreaTransitions();
  m.sync(d);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  d.areas[0].hidden = true;
  m.sync(d);
  expect(m.visibility("a")).toBe(0);
  expect(m.flash("a")).toBe(1);
  vi.unstubAllGlobals();
});
