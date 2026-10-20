import { expect, it, vi } from "vitest";
import { createMapSnapshot } from "./mapRendererSnapshot";

it("abandons a capture after shared assets finish, before it can update or draw a newer scene", async () => {
  let finish;
  const update = vi.fn(),
    render = vi.fn();
  const take = createMapSnapshot({
    runtime: { current: { tiles: [], objects: [] }, options: {}, tier: "lod" },
    assets: {
      ensure: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
    update,
    volumeFog: { render },
  });
  const controller = new AbortController();
  const result = take(controller.signal);
  const cancelled = expect(result).rejects.toMatchObject({
    name: "AbortError",
  });
  controller.abort();
  finish();
  await cancelled;
  expect(update).not.toHaveBeenCalled();
  expect(render).not.toHaveBeenCalled();
});
