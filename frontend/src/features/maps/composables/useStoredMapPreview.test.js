import { effectScope, ref } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useStoredMapPreview } from "./useStoredMapPreview";
const state = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("../lib/mapStoredPreviews", () => ({
  ensureStoredMapPreview: state.generate,
}));
let scope, input, preview;
beforeEach(() => {
  vi.useFakeTimers();
  state.generate.mockReset().mockResolvedValue("/new");
  input = {
    source: { id: "map", previewSignature: "a" },
    journal: { revision: ref(0), dirty: ref(false) },
    gesturing: ref(false),
    loadingModels: ref(false),
    saving: ref(false),
    conflict: ref(false),
  };
  scope = effectScope();
  preview = scope.run(() => useStoredMapPreview(input));
});
afterEach(() => {
  scope.stop();
  vi.useRealTimers();
});
it("waits for eight seconds of a clean saved document and drops intermediate saves", async () => {
  await vi.advanceTimersByTimeAsync(7000);
  expect(state.generate).not.toHaveBeenCalled();
  input.journal.dirty.value = true;
  input.journal.revision.value++;
  await vi.advanceTimersByTimeAsync(8000);
  expect(state.generate).not.toHaveBeenCalled();
  preview.saved({ id: "map", previewSignature: "b" });
  input.journal.dirty.value = false;
  await vi.advanceTimersByTimeAsync(7000);
  input.journal.dirty.value = true;
  preview.saved({ id: "map", previewSignature: "c" });
  input.journal.dirty.value = false;
  await vi.advanceTimersByTimeAsync(8000);
  expect(state.generate).toHaveBeenCalledOnce();
  expect(state.generate.mock.calls[0][0].previewSignature).toBe("c");
});
it("aborts captures on new edits and removes scheduled work on unmount", async () => {
  state.generate.mockImplementation(() => new Promise(() => {}));
  await vi.advanceTimersByTimeAsync(8000);
  const signal = state.generate.mock.calls[0][1].signal;
  input.gesturing.value = true;
  expect(signal.aborted).toBe(true);
  input.gesturing.value = false;
  scope.stop();
  await vi.advanceTimersByTimeAsync(10000);
  expect(state.generate).toHaveBeenCalledOnce();
});
it("does not regenerate fresh previews or render while saving, conflicted, or in a session", async () => {
  preview.saved({ id: "map", previewUrl: "/ready" });
  await vi.advanceTimersByTimeAsync(10000);
  expect(state.generate).not.toHaveBeenCalled();
  input.saving.value = true;
  preview.saved({ id: "map", previewUrl: "/old", previewStale: true });
  await vi.advanceTimersByTimeAsync(10000);
  expect(state.generate).not.toHaveBeenCalled();
  input.conflict.value = true;
  input.saving.value = false;
  await vi.advanceTimersByTimeAsync(10000);
  expect(state.generate).not.toHaveBeenCalled();
  scope.stop();
  input.session = true;
  scope = effectScope();
  scope.run(() => useStoredMapPreview({ ...input, conflict: ref(false) }));
  await vi.advanceTimersByTimeAsync(10000);
  expect(state.generate).not.toHaveBeenCalled();
});
