import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const directory = path.resolve(import.meta.dirname,
  "../../../models/collections/medieval-town-vol1/review/MT1-016");

for (const tier of ["render", "lod"]) {
  test(`real torch ${tier}: flame stays at 12 FPS while its body stays fixed`, async ({ page }) => {
    test.skip(!fs.existsSync(path.join(directory, `${tier}.glb`)), "Local model excluded from Git");
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && /WebGL|Shader|GL_INVALID/.test(m.text())) errors.push(m.text());
    });
    await page.route("**/fire-model.glb", (route) => route.fulfill({
      path: path.join(directory, `${tier}.glb`), contentType: "model/gltf-binary",
    }));
    await page.goto("/tests/maps/fixtures/modelFire.html");
    await page.waitForFunction(() => window.modelFire);
    const compare = (...args) => page.evaluate((args) => window.modelFire.compare(...args), args);
    expect(await compare(1, 40)).toEqual({ changed: 0, outside: 0 });
    for (const opacity of [1, 0.5]) {
      const result = await compare(1, 100, opacity);
      expect(result.changed).toBeGreaterThan(50);
      expect(result.outside).toBe(0);
    }
    expect((await compare(85, 160)).changed).toBe(0);
    expect((await compare(160, 170)).changed).toBeGreaterThan(50);
    expect((await compare(1, 100, 0)).changed).toBe(0);
    expect((await compare(1, 100, 1, false)).changed).toBe(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect((await compare(1, 100)).changed).toBe(0);
    expect(errors).toEqual([]);
  });
}

test("torch reference keeps the animated preview without a frequency setting", async ({ page }) => {
  test.skip(!fs.existsSync(path.join(directory, "render.glb")), "Local model excluded from Git");
  await page.setViewportSize({ width: 1440, height: 1100 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/fire-model.glb", (route) => route.fulfill({
    path: path.join(directory, "render.glb"), contentType: "model/gltf-binary",
  }));
  await page.goto("/tests/maps/fixtures/modelFireReference.html");
  const slider = page.getByRole("slider", { name: "Частота анимации огня", exact: true }),
    save = page.getByRole("button", { name: "Сохранить параметры", exact: true });
  await expect(slider).toHaveCount(0);
  await expect(page.locator(".model-preview-label")).toHaveCount(5);
  await expect(save).toBeDisabled();
  expect(errors).toEqual([]);
});
