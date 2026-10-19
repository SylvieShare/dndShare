import { expect, it, vi } from "vitest";
import { pruneModelResidency } from "./modelResidency";

it("evicts the oldest inactive models while keeping the scene pinned even over budget", () => {
  const owned = new Map(
    ["old", "live", "recent"].map((url, used) => [
      url,
      { used, value: { usage: { geometryBytes: 80, textureBytes: 20 } } },
    ]),
  );
  const remove = vi.fn((url) => owned.delete(url));
  pruneModelResidency(owned, new Map([["live", {}]]), remove, {
    bytes: 150,
    files: 2,
  });
  expect(remove.mock.calls.flat()).toEqual(["old", "recent"]);
  expect([...owned.keys()]).toEqual(["live"]);
  pruneModelResidency(owned, new Map([["live", {}]]), remove, {
    bytes: 1,
    files: 0,
  });
  expect(owned.has("live")).toBe(true);
});
