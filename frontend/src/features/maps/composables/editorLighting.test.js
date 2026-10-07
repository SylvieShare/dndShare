import { expect, it, vi } from "vitest";
import { ref } from "vue";
import { editorLighting } from "./editorLighting";
function setup(lights = []) {
  const e = {
    draft: ref({
      document: {
        width: 8,
        height: 8,
        tiles: [],
        objects: [],
        lights,
        areas: [],
      },
    }),
    catalogue: ref([]),
    tool: ref("select"),
    hoveredTile: ref(""),
    hoveredObject: ref(""),
    selection: ref(null),
    history: ref([]),
    setTileSelection: vi.fn(),
    setObjectSelection: vi.fn(),
    pauseSave: vi.fn(),
    checkpoint: vi.fn(),
    change(fn) {
      fn(e.draft.value);
    },
  };
  return { e, lighting: editorLighting(e) };
}
it("copies a detached snapshot and reuses it after editing the original, multiple drops and cancellation", () => {
  const source = {
    id: "lamp",
    name: "Лампа",
    kind: "magic",
    color: "#3366ff",
    height: 1.5,
    radius: 5,
    intensity: 7,
    enabled: false,
    shadows: false,
    showMarker: false,
    flicker: false,
    anchor: { kind: "tile", id: "source" },
    areaId: "room",
    offset: [0.2, 0.3],
    x: 2,
    y: 2,
    elevation: 0,
  };
  const { e, lighting: l } = setup([source]);
  l.selectLight("lamp");
  expect(l.copyLight()).toBe(true);
  expect(l.copiedLight.value.anchor).toBeUndefined();
  expect(l.copiedLight.value.areaId).toBeUndefined();
  e.draft.value.document.lights[0].color = "#ffffff";
  for (const x of [3, 4]) {
    l.driver.begin(l.copiedLight.value);
    l.driver.move({ x, y: 3, elevation: 2 });
    expect(l.previewLight.value).toMatchObject({
      x,
      elevation: 2,
      color: "#3366ff",
      height: 1.5,
      showMarker: false,
    });
    l.driver.drop({ x, y: 3, elevation: 2 });
  }
  expect(e.draft.value.document.lights).toHaveLength(3);
  expect(new Set(e.draft.value.document.lights.map((l) => l.id)).size).toBe(3);
  expect(e.draft.value.document.lights[1]).toMatchObject({
    enabled: false,
    shadows: false,
    showMarker: false,
  });
  l.driver.begin(l.copiedLight.value);
  l.driver.cancel();
  expect(l.previewLight.value).toBe(null);
  expect(e.tool.value).toBe("select");
  expect(l.copiedLight.value.color).toBe("#3366ff");
});
it("keeps a copied source usable when both shadow slots are already occupied", () => {
  const { e, lighting: l } = setup(
    [0, 1].map((i) => ({
      id: `light-${i}`,
      kind: "torch",
      enabled: true,
      shadows: true,
    })),
  );
  l.selectLight("light-0");
  l.copyLight();
  l.driver.begin(l.copiedLight.value);
  l.driver.drop({ x: 4, y: 4, elevation: 0 });
  expect(e.draft.value.document.lights[2].shadows).toBe(false);
});
it("binds after clicking a model, consumes the click and cancels picking with Escape", () => {
  const { e, lighting: l } = setup([
    { id: "lamp", kind: "torch", x: 1, y: 1, height: 1, offset: [0, 0] },
  ]);
  e.draft.value.document.tiles.push({
    id: "floor",
    modelId: "floor-model",
    x: 2,
    y: 3,
    level: 0,
    rotation: 0,
  });
  e.catalogue.value.push({
    id: "floor-model",
    width: 1,
    height: 1,
    surfaceHeight: 0.4,
    maxHeight: 0.4,
    mountDepth: 0.1,
    supportSlots: [],
  });
  l.selectLight("lamp");
  l.beginLightBinding("lamp");
  expect(e.tool.value).toBe("bind-light");
  expect(l.handle({ phase: "start", hit: null })).toBe(true);
  expect(l.bindingLight.value).toBe("lamp");
  expect(l.handle({ phase: "start", hit: { tileId: "floor" } })).toBe(true);
  expect(e.draft.value.document.lights[0]).toMatchObject({
    anchor: { kind: "tile", id: "floor" },
    x: 2.5,
    y: 3.5,
  });
  expect(e.draft.value.document.lights[0].elevation).toBeCloseTo(0.3);
  expect(l.selectedLight.value).toBe("lamp");
  expect(l.handle({ phase: "end" })).toBe(true);
  expect(e.tool.value).toBe("select");
  l.beginLightBinding("lamp");
  expect(l.handle({ phase: "cancel" })).toBe(true);
  expect(l.bindingLight.value).toBe("");
});
it("enables a source from its icon even when its old shadow option exceeds the current budget", () => {
  const { e, lighting: l } = setup([
    { id: "a", enabled: true, shadows: true },
    { id: "b", enabled: true, shadows: true },
    { id: "c", enabled: false, shadows: true },
  ]);
  l.toggleLight("c");
  expect(e.draft.value.document.lights[2]).toMatchObject({
    enabled: true,
    shadows: false,
  });
});
