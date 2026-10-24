import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { localModelAssets } from "./localModelAssets";
import { dragTile } from "./editorHelpers";

test("painted GLBs decode both tiers and render PBR textures in the editor", { tag: "@local-model" }, async ({
  page,
}) => {
  test.setTimeout(90000);
  const assets =
    process.env.MAP_MODEL_TEST_ASSETS ||
    path.resolve(
      import.meta.dirname,
      "../../../models/collections/painted/ultimate-dungeon",
    );
  test.skip(
    !fs.existsSync(path.join(assets, "UD-031/render.glb")),
    "Local scans are excluded from Git",
  );
  const errors = [],
    fetched = new Set();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /THREE|WebGL|shader|decode/i.test(message.text())
    )
      errors.push(message.text());
  });
  const tiers = code => ({ render: path.join(assets, code, 'render.glb'), lod: path.join(assets, code, 'lod.glb'), shadow: path.join(assets, code, 'render.glb') });
  await localModelAssets(page, { wall: tiers('UD-002'), floor: tiers('UD-031') }, tier => fetched.add(tier));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor&realModels");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  const before = await page.evaluate(
    () => window.latestBoard.document.tiles.length,
  );
  const bounds = await page.locator(".map-canvas").boundingBox();
  await dragTile(page, {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  });
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.tiles.length))
    .toBe(before + 1);
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.wheel(0, -900);
  await expect.poll(() => fetched.has("render")).toBe(true);
  await page.mouse.wheel(0, 1800);
  await expect.poll(() => fetched.has("lod")).toBe(true);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});
