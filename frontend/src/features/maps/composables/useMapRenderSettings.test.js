import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());
it("shares a restored render preference without changing the map document", async () => {
  vi.resetModules();
  const storage = { getItem: () => "true", setItem: vi.fn() };
  vi.stubGlobal("localStorage", storage);
  const { useMapRenderSettings } = await import("./useMapRenderSettings");
  const first = useMapRenderSettings(),
    second = useMapRenderSettings();
  expect(first.forceLod.value).toBe(true);
  first.forceLod.value = false;
  expect(second.forceLod.value).toBe(false);
  expect(storage.setItem).toHaveBeenCalledWith(
    "dndshare.maps.force-lod",
    "false",
  );
});

it("works when browser storage is disabled", async () => {
  vi.resetModules();
  vi.stubGlobal("localStorage", {
    getItem() {
      throw new Error("unavailable");
    },
    setItem() {
      throw new Error("unavailable");
    },
  });
  const { useMapRenderSettings } = await import("./useMapRenderSettings");
  const { forceLod } = useMapRenderSettings();
  expect(forceLod.value).toBe(false);
  forceLod.value = true;
  expect(forceLod.value).toBe(true);
});
