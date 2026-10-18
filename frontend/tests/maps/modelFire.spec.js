import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const directory = path.resolve(import.meta.dirname,
  "../../../models/collections/medieval-town-vol1/review/MT1-016");

for (const tier of ["render", "lod"]) {
  test(`real torch ${tier}: flame changes at chosen FPS while its body stays fixed`, async ({ page }) => {
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
      const result = await compare(1, 100, 12, opacity);
      expect(result.changed).toBeGreaterThan(50);
      expect(result.outside).toBe(0);
    }
    expect((await compare(1, 900, 1)).changed).toBe(0);
    expect((await compare(1, 40, 60)).changed).toBeGreaterThan(50);
    expect((await compare(1, 100, 12, 0)).changed).toBe(0);
    expect((await compare(1, 100, 12, 1, false)).changed).toBe(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect((await compare(1, 100)).changed).toBe(0);
    expect(errors).toEqual([]);
  });
}

test("torch reference previews FPS changes and saves them with the existing behaviour", async ({ page }) => {
  test.skip(!fs.existsSync(path.join(directory, "render.glb")), "Local model excluded from Git");
  await page.setViewportSize({ width: 1440, height: 1100 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/fire-model.glb", (route) => route.fulfill({
    path: path.join(directory, "render.glb"), contentType: "model/gltf-binary",
  }));
  let saved;
  await page.route("**/api/maps/models/*", (route) => {
    saved = route.request().postDataJSON();
    return route.fulfill({ json: {
      ...saved, behaviour: { ...saved.behaviour, revision: 2 },
      renderUrl: "/fire-model.glb", lodUrl: "/fire-model.glb", previewUrl: "/tests/maps/fixtures/preview.svg",
    } });
  });
  await page.goto("/tests/maps/fixtures/modelFireReference.html");
  const slider = page.getByRole("slider", { name: "Частота анимации огня", exact: true }),
    save = page.getByRole("button", { name: "Сохранить параметры", exact: true });
  await expect(slider).toHaveValue("12");
  await expect(page.locator(".model-preview-label")).toHaveCount(5);
  await expect(save).toBeDisabled();
  await slider.fill("24");
  await expect(page.getByText("Частота анимации: 24 FPS", { exact: true })).toBeVisible();
  await save.click();
  await expect(page.getByText("Параметры сохранены", { exact: true })).toBeVisible();
  expect(saved.behaviour.animationFps).toBe(24);
  expect(saved.behaviour.defaultLights[0].key).toBe("torch-flame");
  await slider.fill("60");
  await page.getByRole("button", { name: "Отменить изменения", exact: true }).click();
  await expect(slider).toHaveValue("24");
  await expect(save).toBeDisabled();
  expect(errors).toEqual([]);
});
