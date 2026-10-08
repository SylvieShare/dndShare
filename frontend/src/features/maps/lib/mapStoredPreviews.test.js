import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  context: vi.fn(),
  upload: vi.fn(),
  snapshot: vi.fn(),
}));
vi.mock("@/shared/api/mapsApi", () => ({
  getMapPreviewContext: state.context,
  uploadMapPreview: state.upload,
}));
vi.mock("../rendering/mapSnapshots", () => ({
  requestMapSnapshot: state.snapshot,
}));
import { ensureStoredMapPreview } from "./mapStoredPreviews";
beforeEach(() => {
  vi.clearAllMocks();
  state.context.mockResolvedValue({
    document: { tiles: [] },
    models: [{ id: "current" }],
    signature: "new",
  });
  state.snapshot.mockResolvedValue(new Blob(["webp"]));
  state.upload.mockResolvedValue({ previewUrl: "/stored" });
});
it("uses stored URLs without loading models or running a renderer", async () => {
  expect(await ensureStoredMapPreview({ id: "ready", previewUrl: "/s3" })).toBe(
    "/s3",
  );
  expect(state.context).not.toHaveBeenCalled();
  expect(state.snapshot).not.toHaveBeenCalled();
});
it("deduplicates uploads and renders the current server catalogue", async () => {
  const m = { id: "map", previewSignature: "old" };
  const results = await Promise.all([
    ensureStoredMapPreview(m),
    ensureStoredMapPreview(m),
  ]);
  expect(results).toEqual(["/stored", "/stored"]);
  expect(state.snapshot).toHaveBeenCalledOnce();
  expect(state.snapshot).toHaveBeenCalledWith({ tiles: [] }, undefined, {
    catalogue: [{ id: "current" }],
    key: "new",
  });
  expect(state.upload).toHaveBeenCalledOnce();
});
it("rebuilds a screenshot if the map changed during upload", async () => {
  state.upload.mockRejectedValueOnce(
    Object.assign(new Error("stale"), { status: 409 }),
  );
  state.context.mockResolvedValueOnce({
    document: {},
    models: [],
    signature: "old",
  });
  expect(await ensureStoredMapPreview({ id: "changing" })).toBe("/stored");
  expect(state.upload.mock.calls.map((c) => c[1])).toEqual(["old", "new"]);
});
