import { localModelAssets } from "./localModelAssets";
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { dragTile, mapPoint } from "./editorHelpers";
for (const real of [false, true])
  test(`object placement uses shared raised points ${real ? "with the prepared chest GLB" : "in the library"}`, { tag: real ? "@local-model" : "@browser" }, async ({
    page,
  }) => {
    const root = path.resolve(import.meta.dirname, "../../../models");
    test.skip(
      real && !fs.existsSync(path.join(root, "objects/chest/render.glb")),
      "Local source assets are excluded from Git",
    );
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    if (real) {
      const tiers = code => ({ render: path.join(root,'prepared/runtime',`${code}.render.glb`), lod: path.join(root,'prepared/runtime',`${code}.lod.glb`), shadow: path.join(root,'prepared/runtime',`${code}.render.glb`) });
      await localModelAssets(page, { wall: tiers('LC-001'), floor: tiers('LC-007'), chest: { render: path.join(root,'objects/chest/render.glb'), lod: path.join(root,'objects/chest/lod.glb'), shadow: path.join(root,'objects/chest/render.glb') } });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(
      `/tests/maps/fixtures/maps.html?mode=editor${real ? "&realModels" : ""}`,
    );
    await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
    await page.getByTitle("Вид сверху", { exact: true }).click();
    await dragTile(page, await mapPoint(page, 4.5, 4.5));
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.lastSaved?.document.tiles.some((t) => t.x === 4 && t.y === 4),
        ),
      )
      .toBe(true);
    const rail = page.getByRole("navigation", {
      name: "Боковые вкладки редактора",
    });
    await rail.getByRole("button", { name: "Объекты", exact: true }).click();
    const objects = page.getByRole("region", { name: "Каталог объектов" });
    await expect(objects.getByRole("button")).toHaveCount(1);
    await objects
      .getByRole("button", { name: "Сундук", exact: true })
      .press("Enter");
    const point = await mapPoint(page, 4.5, 4.5);
    await page.mouse.move(point.x, point.y);
    await page.mouse.click(point.x, point.y);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.lastSaved?.document.objects.some(
            (o) =>
              o.modelId?.startsWith("ffffffff") && o.placement?.point === 0,
          ),
        ),
      )
      .toBe(true);
    const placed = await page.evaluate(() =>
      window.lastSaved.document.objects.find((o) => o.modelId),
    );
    const parent = await page.evaluate(() =>
      window.lastSaved.document.tiles.find((t) => t.x === 4 && t.y === 4),
    );
    expect(placed.placement.tileId).toBe(parent.id);
    expect(placed).toMatchObject({ x: 4.5, y: 4.5 });
    expect(
      await page.evaluate(() =>
        window.loadedModels.some(
          (p) => p.includes("ffffffff") && p.endsWith("/render"),
        ),
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
