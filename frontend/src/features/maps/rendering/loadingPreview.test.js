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
