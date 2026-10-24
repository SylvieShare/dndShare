import { afterEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/shared/model3d/fetchModelResource", () => ({
  fetchModelResource: fake.fetch,
}));
import { loadModelCatalogue, resetModelCatalogue } from "./mapModelCatalogue";
const models = [{ id: "UD-010", uuid: "uuid", name: "Дверь" }];
afterEach(() => {
  resetModelCatalogue();
  vi.useRealTimers();
});
it("shares metadata requests and retries network failures without turning them into a missing model", async () => {
  vi.useFakeTimers();
  fake.fetch
    .mockReset()
    .mockRejectedValueOnce(
      Object.assign(new Error("network"), { retryable: true }),
    )
    .mockResolvedValue(models);
  let file;
  const a = loadModelCatalogue(undefined, {
      onRequest: (value) => (file = value),
    }),
    b = loadModelCatalogue();
  await vi.advanceTimersByTimeAsync(0);
  expect(file.state.status).toBe("retrying");
  await vi.advanceTimersByTimeAsync(1000);
  expect(await a).toEqual([
    { id: "uuid", definitionId: "UD-010", name: "Дверь" },
  ]);
  expect(await b).toEqual(await a);
  expect(fake.fetch).toHaveBeenCalledTimes(2);
  expect(file.state.status).toBe("ready");
});
it("stops infinite retries after the last owner cancels", async () => {
  vi.useFakeTimers();
  fake.fetch
    .mockReset()
    .mockRejectedValue(
      Object.assign(new Error("offline"), { retryable: true }),
    );
  const controller = new AbortController();
  const promise = loadModelCatalogue(undefined, { signal: controller.signal });
  const rejected = expect(promise).rejects.toMatchObject({
    name: "AbortError",
  });
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  await rejected;
  await vi.advanceTimersByTimeAsync(60000);
  expect(fake.fetch).toHaveBeenCalledTimes(1);
});
