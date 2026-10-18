import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("fountain water animates both tiers and instancing while stone stays still", async ({
  page,
}) => {
  test.setTimeout(90000);
  const directory = process.env.MAP_REVIEW_TEST_ASSETS;
  test.skip(!directory, "Prepared fountain assets required");
  const report = JSON.parse(
      fs.readFileSync(path.join(directory, "report.json"), "utf8"),
    ),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/model-review/*.glb", (route) =>
    route.fulfill({
      path: path.join(directory, path.basename(route.request().url())),
      contentType: "model/gltf-binary",
    }),
  );
  await page.goto("/tests/maps/fixtures/waterAnimation.html");
  await page.waitForFunction(() => window.reviewWater);
  for (const tier of ["render", "lod"])
    for (const instanced of [false, true]) {
      const result = await page.evaluate(
        ({ tier, model, instanced }) =>
          window.reviewWater(tier, model, instanced),
        { tier, model: report.model, instanced },
      );
      expect(result.waterParts).toBeGreaterThan(0);
      expect(result.animated, JSON.stringify(result)).toBeGreaterThan(500);
      expect(result.stoneChanged, JSON.stringify(result)).toBeLessThan(40);
      expect(result.sameChanged).toBe(0);
      expect(result.frozen).toBe(true);
    }
  await page
    .locator("canvas")
    .screenshot({ path: "target/water-animation-preview.png" });
  await expect(
    page.getByRole("slider", { name: "Скорость течения", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("slider", { name: "Скорость течения", exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
  expect(await page.evaluate(() => window.waterSettings.speed)).toBeGreaterThan(
    1,
  );
  await expect(
    page.getByRole("slider", { name: "Сила волн", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
