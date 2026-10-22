import { expect, it, vi } from "vitest";
import { ref } from "vue";
import { sessionMapRemoval } from "./sessionMapRemoval";
const make = () => {
  let done, fail;
  const maps = ref([
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ]),
    selectedID = ref("a"),
    display = ref({ mapId: "a", visible: true, camera: { sceneId: "cam" } }),
    notify = vi.fn(),
    settled = vi.fn();
  const removal = sessionMapRemoval({
    maps,
    selectedID,
    display,
    notify,
    settled,
    request: () =>
      new Promise((resolve, reject) => {
        done = resolve;
        fail = reject;
      }),
  });
  return {
    maps,
    selectedID,
    display,
    notify,
    settled,
    removal,
    done: () => done(),
    fail: () => fail(new Error("network")),
  };
};
it("removes immediately while the request is pending and does not delete another map", async () => {
  const c = make();
  expect(c.removal.remove("a")).toBe(true);
  expect(c.maps.value.map((m) => m.id)).toEqual(["b"]);
  expect(c.selectedID.value).toBe("b");
  expect(c.display.value.visible).toBe(false);
  await Promise.resolve();
  c.done();
  await c.removal.wait();
  expect(c.maps.value.map((m) => m.id)).toEqual(["b"]);
  expect(c.notify).not.toHaveBeenCalled();
});
it("restores a failed delete in place and reports it without stealing the active map", async () => {
  const c = make();
  c.removal.remove("a");
  await Promise.resolve();
  c.fail();
  await c.removal.wait();
  expect(c.maps.value.map((m) => m.id)).toEqual(["a", "b"]);
  expect(c.selectedID.value).toBe("b");
  expect(c.notify).toHaveBeenCalledWith(
    expect.objectContaining({ id: "a" }),
    expect.any(Error),
  );
});
