import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = path.resolve(import.meta.dirname,
  "../../../models/collections/medieval-town-vol1/upload"),
  files = {
    render: path.join(base, "MT1-016/4ff49b97ef1cc105973a539c41e1d38f737a2527b9356cb5d113b59628e2d22b.glb"),
    old: path.join(base, "MT1-016/52a6e8c9bb05fd853b48c796a669c7752ce4c1a4f7439a3dfc1bf8616fe763d4.glb"),
    fixed: path.join(base, "MT1-017/0842fd90a412150eed8cb5086d12aa452054e52d15c683935a967a24c4a567eb.glb"),
  };

test("torch light escapes its flame while solid objects still cast shadows", async ({ page }) => {
  test.skip(Object.values(files).some((f) => !fs.existsSync(f)), "Local models excluded from Git");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /WebGL|Shader|GL_INVALID/.test(m.text())) errors.push(m.text());
  });
  await page.route("**/torch-shadow/*", (route) => route.fulfill({
    path: files[new URL(route.request().url()).pathname.split("/").at(-1)],
    contentType: "model/gltf-binary",
  }));
  await page.goto("/tests/maps/fixtures/torchShadow.html");
  await page.waitForFunction(() => window.torchShadow);
  const draw = (...args) => page.evaluate((args) => window.torchShadow(...args), args);
  const old = await draw("old"), fixed = await draw("fixed"),
    blocked = await draw("fixed", true), plain = await draw("fixed", false, false);
  console.log("TORCH_SHADOW", JSON.stringify({ old, fixed, blocked, plain }));
  expect(fixed.east).toBeGreaterThan(old.east + 25);
  expect(fixed.north).toBeGreaterThan(old.north + 25);
  expect(blocked.north).toBeLessThan(fixed.north - 25);
  expect(Math.abs(blocked.east - fixed.east)).toBeLessThan(5);
  expect(fixed.east / plain.east).toBeGreaterThan(0.9);
  expect(errors).toEqual([]);
});
