import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../../../models"),
  manifestPath = path.join(root, "shadows/manifest.json");
const available = fs.existsSync(manifestPath);
const manifest = available ? JSON.parse(fs.readFileSync(manifestPath)) : [];
const registryPath =
  process.env.DNDSHARE_SHADOW_TEST_CATALOGUE ||
  "/private/tmp/dndshare-shadow-registry.json";
const registry = fs.existsSync(registryPath)
  ? JSON.parse(fs.readFileSync(registryPath))
  : [];
const local = new Map();
function index(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) index(p);
    else if (/^[a-f0-9]{64}\.glb$/.test(e.name)) local.set(e.name, p);
  }
}
if (available) index(root);
for (const code of ["UD-022", "UD-042", "MA-DungeonChest"]) {
  test(`real shadow geometry preserves illuminated surfaces of ${code}`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const entry = manifest.find((m) => m.sourceCode === code),
      model = registry.find((m) => m.id === entry?.id);
    test.skip(!entry || !model, "Local model assets are excluded from Git");
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && /THREE|WebGL|shader/.test(m.text()))
        errors.push(m.text());
    });
    await page.route("**/shadow-case", (route) =>
      route.fulfill({
        json: {
          model: {
            ...model,
            renderUrl: "/shadow-asset/render",
            lodUrl: "/shadow-asset/lod",
            shadowUrl: "/shadow-asset/shadow",
          },
        },
      }),
    );
    await page.route("**/shadow-asset/*", async (route) => {
      const role = new URL(route.request().url()).pathname.split("/").at(-1),
        sha =
          role === "shadow" ? entry.asset.sha256 : model.assets[role].sha256;
      await route.fulfill({
        path: local.get(`${sha}.glb`),
        contentType: "model/gltf-binary",
      });
    });
    await page.goto("/tests/maps/fixtures/shadows.html");
    await page.waitForFunction(() => window.ready);
    const results = [];
    for (const angle of [0, 90, 180, 270])
      results.push({
        angle,
        ...(await page.evaluate((a) => window.compare(a, "sun"), angle)),
      });
    const point = await page.evaluate(() => window.compare(0, "point"));
    console.log(
      "SHADOW_SURFACES",
      JSON.stringify({ code, sun: results, point }),
    );
    for (const r of [...results, point]) {
      expect(r.count).toBeGreaterThan(1000);
      expect(r.ratio).toBeGreaterThan(0.8);
      expect(r.errors).toEqual([]);
    }
    await page.goto("/tests/maps/fixtures/shadows.html?legacy");
    await page.waitForFunction(() => window.ready);
    const old = await page.evaluate(() => window.compare(0, "sun"));
    console.log("SHADOW_ENCLOSURE_CONTROL", JSON.stringify({ code, old }));
    expect(results[0].ratio).toBeGreaterThan(old.ratio + 0.1);
    expect(errors).toEqual([]);
  });
}
