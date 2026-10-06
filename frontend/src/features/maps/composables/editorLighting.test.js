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
