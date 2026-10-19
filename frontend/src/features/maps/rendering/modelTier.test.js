import { expect, it } from "vitest";
import { modelTier } from "./modelTier";

it("keeps geometry stable while zoom crosses the former single threshold", () => {
  let tier = modelTier(90);
  for (const pixels of [75, 71, 73, 65]) tier = modelTier(pixels, tier);
  expect(tier).toBe("render");
  tier = modelTier(63, tier);
  expect(tier).toBe("lod");
  for (const pixels of [67, 73, 79]) tier = modelTier(pixels, tier);
  expect(tier).toBe("lod");
  expect(modelTier(80, tier)).toBe("render");
});

it("keeps forced LOD at close range and restores automatic detail when disabled", () => {
  expect(modelTier(400, "render", true)).toBe("lod");
  expect(modelTier(400, "lod", true)).toBe("lod");
  expect(modelTier(400, "lod", false)).toBe("render");
});
