import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/shared/api/mapsApi", () => ({
  getSessionMaps: api.get,
  saveSessionMap: api.save,
  addSessionMap: vi.fn(),
  deleteSessionMap: api.remove,
  saveMapDisplay: vi.fn(),
}));
vi.mock("@/stores/notifications", () => ({
  useNotificationsStore: () => ({ notify: api.notify }),
}));
vi.mock("./useMapSync", () => ({ useMapSync: () => ({ connected: true }) }));
import { useSessionMaps } from "./useSessionMaps";
const map = () => ({
  id: "map",
  name: "template",
  document: { width: 10 },
  state: { tokens: [] },
  revision: 1,
  source: { id: "source", name: "Source" },
});
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ maps: [map()], display: { mapId: "map" } });
});
it("an in-flight read cannot replace a gesture or unsaved scene", async () => {
  const c = useSessionMaps("session");
  await c.load();
  let resolve;
  api.get.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = c.load();
  c.working(true);
  resolve({ maps: [{ ...map(), revision: 9 }], display: { mapId: "map" } });
  await pending;
  expect(c.selected.value.revision).toBe(1);
});
it("writes scene and play state together and keeps source identity", async () => {
  const c = useSessionMaps("session");
  await c.load();
  const draft = {
    ...map(),
    name: "Edited",
    document: { width: 12 },
    state: { tokens: [{ id: "hero" }] },
  };
  api.save.mockResolvedValue({ ...draft, revision: 2 });
  await c.write(draft);
  expect(api.save).toHaveBeenCalledWith("session", draft);
  expect(c.selected.value).toMatchObject({
    name: "Edited",
    document: { width: 12 },
    state: { tokens: [{ id: "hero" }] },
    source: { id: "source" },
    revision: 2,
  });
});
it("a stale write is reported without replacing the current scene", async () => {
  const c = useSessionMaps("session");
  await c.load();
  api.save.mockRejectedValue(
    Object.assign(new Error("conflict"), { status: 409 }),
  );
  await expect(c.write({ ...map(), document: { width: 20 } })).rejects.toThrow(
    "conflict",
  );
  expect(c.conflict.value).toBe(true);
  expect(c.saving.value).toBe(false);
  expect(c.selected.value.document.width).toBe(10);
});
it("a slow delete hides the map immediately and a stale concurrent list cannot resurrect it", async () => {
  const c = useSessionMaps("session");
  await c.load();
  let finishRead, finishDelete;
  api.get.mockImplementationOnce(
    () => new Promise((resolve) => (finishRead = resolve)),
  );
  const read = c.load();
  api.remove.mockImplementationOnce(
    () => new Promise((resolve) => (finishDelete = resolve)),
  );
  expect(c.remove("map")).toBe(true);
  expect(c.maps.value).toEqual([]);
  await Promise.resolve();
  finishRead({ maps: [map()], display: { mapId: "map" } });
  await read;
  expect(c.maps.value).toEqual([]);
  api.get.mockResolvedValue({ maps: [], display: { mapId: null } });
  finishDelete();
  for (let n = 0; n < 20; n++) await Promise.resolve();
  expect(c.maps.value).toEqual([]);
  expect(api.notify).not.toHaveBeenCalled();
});
it("failed deletion restores the last map and uses the global error notification", async () => {
  const c = useSessionMaps("session");
  await c.load();
  api.remove.mockRejectedValueOnce(new Error("offline"));
  expect(c.remove("map")).toBe(true);
  expect(c.maps.value).toEqual([]);
  for (let n = 0; n < 20; n++) await Promise.resolve();
  expect(c.selected.value.id).toBe("map");
  expect(api.notify).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "error",
      title: expect.stringContaining("template"),
      data: { message: "offline" },
    }),
  );
});
