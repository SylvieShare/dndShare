import { expect, it } from "vitest";
import { localPreviewContext } from "./localPreviewContext";

async function signedMap() {
  const pairs = [
    ["a", "first"],
    ["b", "second"],
  ];
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(pairs)),
  );
  return {
    id: "map",
    previewSignature: "scene",
    previewModelsSignature: [...new Uint8Array(hash)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
    document: {
      tiles: [{ modelId: "b" }, { modelId: "b" }],
      objects: [{ modelId: "a" }, { kind: "door" }],
    },
  };
}
it("reuses the saved document only when every used model matches the server's signature", async () => {
  const map = await signedMap();
  const models = [
    { id: "b", previewSignature: "second" },
    { id: "unused" },
    { id: "a", previewSignature: "first" },
  ];
  expect(await localPreviewContext(map, models)).toEqual({
    document: map.document,
    models: [models[0], models[2]],
    signature: "scene",
  });
  models[0].previewSignature = "replaced";
  expect(await localPreviewContext(map, models)).toBeNull();
  expect(await localPreviewContext(map, [models[2]])).toBeNull();
  expect(await localPreviewContext({ id: "summary" }, models)).toBeNull();
});
it("captures an empty map without requiring a whole model catalogue", async () => {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("[]"),
  );
  const map = {
    document: { tiles: [], objects: [] },
    previewSignature: "empty",
    previewModelsSignature: [...new Uint8Array(hash)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
  };
  expect(await localPreviewContext(map, [])).toMatchObject({
    signature: "empty",
    models: [],
  });
});
