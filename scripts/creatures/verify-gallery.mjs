import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("@playwright/test");
const folder = path.resolve(process.argv[2]);
const gallery = JSON.parse(
  await fs.readFile(path.join(folder, "gallery.json"), "utf8"),
);
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-webgl"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://127.0.0.1:15305/preview.html");
await page.waitForFunction(() => window.miniatureReady);
for (const item of gallery) {
  await page.locator(`.model[data-slug="${item.slug}"]`).click();
  await page.waitForFunction(
    (id) => window.miniatureVariant === id,
    `${item.slug}:render`,
  );
  assert.ok(
    (await page.locator("#detail").textContent()).includes(
      String(item.itemIds[0]),
    ),
  );
  await page.locator("#field").click();
  await page.locator("#lod").click();
  await page.waitForFunction(
    (id) => window.miniatureVariant === id,
    `${item.slug}:lod`,
  );
  if (["winged", "guard-1672"].includes(item.slug))
    await page.screenshot({
      path: path.join(folder, `webgl-${item.slug}.png`),
    });
}
await page.locator("#source").click();
await page.waitForFunction(
  () => window.miniatureVariant === "guard-1672:source",
);
await page.locator("#clay").click();
assert.equal(await page.locator("#clay").getAttribute("aria-pressed"), "true");
await page.locator("#clay").click();
await page.setViewportSize({ width: 390, height: 844 });
await page.locator('.model[data-slug="winged"]').click();
await page.waitForFunction(() => window.miniatureVariant === "winged:render");
await page.locator("#close").click();
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(folder, "webgl-mobile.png") });
assert.equal(errors.length, 0, errors.join("\n"));
await fs.writeFile(
  path.join(folder, "viewer-verification.json"),
  JSON.stringify(
    {
      passed: true,
      models: gallery.length,
      variants: gallery.length * 2 + 1,
      errors,
    },
    null,
    2,
  ) + "\n",
);
await browser.close();
console.log(
  JSON.stringify({
    passed: true,
    models: gallery.length,
    variants: gallery.length * 2 + 1,
  }),
);
