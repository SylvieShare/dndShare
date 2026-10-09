import { expect, it } from "vitest";
import { createLoadingPreview } from "./loadingPreview";
it("immediately shows a spinning footprint, follows the pending model and disappears when ready", () => {
  let ready = false,
    count = 0;
  const preview = createLoadingPreview(
    {
      model: () => (ready ? {} : null),
      metadata: () => ({ width: 3, height: 1 }),
    },
    (n) => (count = n),
  );
  preview.update({
    previewTile: { modelId: "bridge", x: 2, y: 3, rotation: 0, elevation: 1 },
  });
  expect(count).toBe(1);
  expect(preview.root.children[0].position.x).toBe(3.5);
  expect(preview.root.children[0].scale.x).toBe(3);
  expect(preview.advance(16)).toBe(true);
  expect(preview.root.children[0].material.uniforms.time.value).toBeGreaterThan(
    0,
  );
  preview.update({
    previewObject: { modelId: "chest", x: 6, y: 4, elevation: 0.8 },
  });
  expect(preview.root.children[0].position.x).toBe(6);
  ready = true;
  preview.update({ previewObject: { modelId: "chest", x: 6, y: 4 } });
  expect(count).toBe(0);
  expect(preview.advance(16)).toBe(false);
  preview.destroy();
});
it("batches missing scene cells and replaces only the models that have become visible", () => {
  const ready = new Set(),
    changed = [];
  const metadata = { width: 1, height: 1 };
  const assets = {
    metadata: () => metadata,
    model: (id) => (ready.has(id) ? {} : null),
    visual: (id) => (ready.has(id) ? {} : null),
  };
  const loading = createLoadingPreview(assets, (count) => changed.push(count));
  const scene = {
    tiles: [
      { id: "a1", modelId: "a", x: 1, y: 2, rotation: 0 },
      { id: "b1", modelId: "b", x: 2, y: 2, rotation: 0 },
    ],
    objects: [],
    tier: "render",
  };
  loading.update(
    {},
    [
      { id: "a", ...metadata },
      { id: "b", ...metadata },
    ],
    scene,
  );
  expect(loading.root.children[0].isInstancedMesh).toBe(true);
  expect(loading.root.children[0].count).toBe(2);
  ready.add("a");
  loading.update({}, [], scene);
  expect(loading.root.children[0].count).toBe(1);
  expect(loading.root.children[0].userData.items[0].id).toBe("b1");
  ready.add("b");
  loading.update({}, [], scene);
  expect(loading.root.visible).toBe(false);
  expect(changed).toEqual([2, 1, 0]);
  loading.destroy();
});
