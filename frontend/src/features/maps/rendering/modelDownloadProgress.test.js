import { expect, it } from "vitest";
import {
  modelDownloadPlan,
  modelDownloadProgress,
} from "./modelDownloadProgress";
it("keeps moving previews at LOD without scheduling full geometry", () => {
  const catalogue = new Map([
    ["a", { lodUrl: "/lod", renderUrl: "/full", shadowUrl: "/shadow" }],
  ]);
  const plan = modelDownloadPlan(
    catalogue,
    new Set(["a"]),
    "lod",
    new Set(["a"]),
    true,
    new Set(["a"]),
    "lod",
  );
  expect([...plan.keys()]).toEqual(["/lod", "/shadow"]);
});
it("counts only unique file URLs, including shared LOD/shadow assets and repeated placements", () => {
  const model = {
    id: "a",
    renderUrl: "/full",
    lodUrl: "/coarse",
    shadowUrl: "/coarse",
    assetBytes: { render: 900, lod: 100, shadow: 100 },
  };
  const plan = modelDownloadPlan(
    new Map([["a", model]]),
    new Set(["a"]),
    "render",
    new Set(["a"]),
    true,
  );
  expect([...plan.keys()]).toEqual(["/coarse", "/full"]);
  const summary = modelDownloadProgress([...plan.values()], () => null);
  expect(summary).toMatchObject({
    total: 2,
    remaining: 2,
    remainingBytes: 1000,
    queued: 2,
    unknown: 0,
  });
  expect(summary.groups.map((g) => g.kind)).toEqual(["render", "lod"]);
});
it("sums remaining bytes for queued, partially loaded and decoding files", () => {
  const files = [
    { url: "/full", kind: "render", bytes: 900 },
    { url: "/coarse", kind: "lod", bytes: 100 },
    { url: "/shadow", kind: "shadow", bytes: 200 },
  ];
  const states = {
    "/full": { status: "loading", loaded: 450, total: 900 },
    "/coarse": { status: "ready" },
    "/shadow": { status: "processing", loaded: 200, total: 200 },
  };
  const summary = modelDownloadProgress(files, (url) => states[url]);
  expect(summary).toMatchObject({
    total: 3,
    ready: 1,
    remaining: 2,
    totalBytes: 1200,
    loadedBytes: 750,
    remainingBytes: 450,
    active: 2,
    processing: 1,
  });
  expect(summary.groups.find((g) => g.kind === "shadow")).toMatchObject({
    remaining: 1,
    remainingBytes: 0,
  });
});
it("does not invent an exact size for files with no length information", () => {
  const summary = modelDownloadProgress(
    [{ url: "/unknown", kind: "lod", bytes: 0 }],
    () => null,
  );
  expect(summary).toMatchObject({
    unknown: 1,
    remaining: 1,
    remainingBytes: 0,
  });
});
