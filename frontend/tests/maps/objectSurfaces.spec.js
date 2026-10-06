import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { dragTile, mapPoint } from "./editorHelpers";
for (const real of [false, true])
  test(`object placement uses shared raised points ${real ? "with the prepared chest GLB" : "in the library"}`, async ({
    page,
  }) => {
    const root = path.resolve(import.meta.dirname, "../../../models");
    test.skip(
      real && !fs.existsSync(path.join(root, "objects/chest/render.glb")),
      "Local source assets are excluded from Git",
    );
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    if (real)
      await page.route("**/api/maps/models/*/*", async (route) => {
        const parts = new URL(route.request().url()).pathname.split("/");
        const tier = parts[5] === "lod" ? "lod" : "render";
        await route.fulfill({
          path: parts[4].startsWith("ffff")
            ? path.join(root, "objects/chest", `${tier}.glb`)
            : path.join(
                root,
                "prepared/runtime",
                `${parts[4].startsWith("1111") ? "LC-001" : "LC-007"}.${tier}.glb`,
              ),
          contentType: "model/gltf-binary",
        });
      });
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
    await objects.getByRole("button", { name: "Сундук", exact: true }).click();
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
