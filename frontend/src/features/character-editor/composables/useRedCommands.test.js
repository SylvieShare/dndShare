import { beforeEach, describe, it, expect, vi } from "vitest";
import { ref } from "vue";
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  rows: new Map(),
  account: { user: { id: 1 } },
}));
vi.mock("@/stores/account", () => ({ useAccountStore: () => mocks.account }));
vi.mock("@/shared/api/http", () => ({
  fetchPost: (...args) => mocks.post(...args),
}));
vi.mock("@/platform/storage", () => ({
  openLocalDatabase: async () => ({
    get: async (key) => mocks.rows.get(key),
    batch: async (rows) => rows.forEach((r) => mocks.rows.set(r.key, r.value)),
  }),
}));
import { useRedCommands } from "./useRedCommands";
const setup = () => {
  const sync = { catchUp: vi.fn().mockResolvedValue() },
    flushSave = vi.fn().mockResolvedValue(true);
  return {
    sync,
    flushSave,
    commands: useRedCommands({
      uuid: ref("hero"),
      version: ref(7),
      canEdit: ref(true),
      sync,
      flushSave,
    }),
  };
};
beforeEach(() => {
  mocks.rows.clear();
  mocks.post.mockReset();
  mocks.account.user.id = 1;
});
describe("RED durable commands", () => {
  it("replays the exact request after a lost response and component recreation", async () => {
    const first = setup();
    mocks.post.mockRejectedValueOnce(new Error("offline"));
    await expect(
      first.commands.roll({ kind: "attack", entryUid: "gun", luck: 2 }),
    ).rejects.toThrow("offline");
    const sent = mocks.post.mock.calls[0][1],
      recovered = setup();
    mocks.post.mockResolvedValueOnce({ version: 8, roll: { total: 22 } });
    expect(await recovered.commands.roll({ kind: "initiative" })).toEqual({
      total: 22,
    });
    expect(mocks.post.mock.calls[1][1]).toEqual(sent);
    expect(recovered.flushSave).not.toHaveBeenCalled();
    expect(recovered.sync.catchUp).toHaveBeenCalledOnce();
    expect(mocks.rows.get("account:1:red-roll:hero")).toBeNull();
  });
  it("keeps requests isolated by account and clears a rejected conflict", async () => {
    mocks.post.mockRejectedValueOnce(new Error("offline"));
    await expect(setup().commands.roll({ kind: "attack" })).rejects.toThrow();
    mocks.account.user.id = 2;
    mocks.post.mockRejectedValueOnce(
      Object.assign(new Error("conflict"), { status: 409 }),
    );
    const second = setup();
    await expect(second.commands.roll({ kind: "initiative" })).rejects.toThrow(
      "conflict",
    );
    expect(mocks.post.mock.calls[1][1].kind).toBe("initiative");
    expect(mocks.rows.get("account:1:red-roll:hero").kind).toBe("attack");
    expect(mocks.rows.get("account:2:red-roll:hero")).toBeNull();
    expect(second.sync.catchUp).toHaveBeenCalledOnce();
  });
});
