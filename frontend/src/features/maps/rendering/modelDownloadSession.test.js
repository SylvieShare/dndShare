import { expect, it } from "vitest";
import { createModelDownloadSession } from "./modelDownloadSession";
it("starts a fresh batch after completion and grows the current batch with new work", () => {
  const session = createModelDownloadSession(),
    states = new Map();
  const a = { url: "a", kind: "lod", bytes: 10 },
    b = { url: "b", kind: "render", bytes: 90 },
    c = { url: "c", kind: "render", bytes: 200 };
  const read = (url) => states.get(url);
  expect(session([a, b], read)).toMatchObject({
    session: 1,
    total: 2,
    remaining: 2,
  });
  states.set("a", { status: "ready" });
  expect(session([a, b, c], read)).toMatchObject({
    session: 1,
    total: 3,
    ready: 1,
    remainingBytes: 290,
  });
  states.set("b", { status: "ready" });
  states.set("c", { status: "ready" });
  expect(session([a, b, c], read)).toMatchObject({
    session: 1,
    total: 3,
    remaining: 0,
  });
  const d = { url: "d", kind: "shadow", bytes: 30 };
  expect(session([a, b, c, d], read)).toMatchObject({
    session: 2,
    total: 1,
    ready: 0,
    remainingBytes: 30,
  });
  states.set("d", { status: "ready" });
  expect(session([a, b, c, d], read)).toMatchObject({
    session: 2,
    total: 1,
    ready: 1,
    remaining: 0,
  });
});
it("does not open a batch for files already cached and removes abandoned queued work", () => {
  const session = createModelDownloadSession(),
    file = { url: "a", kind: "lod", bytes: 10 };
  expect(session([file], () => ({ status: "ready" }))).toMatchObject({
    total: 0,
    remaining: 0,
  });
  expect(session([file], () => ({ status: "queued" }))).toMatchObject({
    session: 1,
    total: 1,
  });
  expect(session([], () => ({ status: "cancelled" }))).toMatchObject({
    remaining: 0,
    total: 0,
  });
});
