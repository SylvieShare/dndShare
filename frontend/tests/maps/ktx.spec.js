import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
test("decodes and renders actual KTX2/Meshopt models in both geometry tiers", async ({
  page,
}) => {
  test.setTimeout(90000);
  const base =
    process.env.MAP_KTX_TEST_ASSETS ||
    path.resolve(
      import.meta.dirname,
      "../../../models/collections/majestic-highlands/optimized-review/MH-001",
    );
  test.skip(
    !fs.existsSync(path.join(base, "render.glb")),
    "Local model files are excluded from Git",
  );
  const report = JSON.parse(
    fs.readFileSync(path.join(base, "report.json"), "utf8"),
  );
  const errors = [],
    decoderRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.url().includes("basis_transcoder"))
      decoderRequests.push({ url: r.url(), status: r.status() });
  });
  await page.route("**/ktx-test/*.glb", (route) =>
    route.fulfill({
      path: path.join(base, path.basename(route.request().url())),
      contentType: "model/gltf-binary",
    }),
  );
  await page.goto("/tests/maps/fixtures/ktx.html");
  await page.waitForFunction(() => window.decodeTile);
  for (const [tier, triangles, size] of [
    ["render", report.tiers.render.triangles, 2048],
    ["lod", report.tiers.lod.triangles, 1024],
  ]) {
    const decoded = await page.evaluate(
      (url) => window.decodeTile(url),
      `/ktx-test/${tier}.glb`,
    );
    expect(decoded.triangles).toBe(triangles);
    expect(decoded.rendered).toBeGreaterThan(0);
    expect(decoded.textures).toHaveLength(3);
    expect(decoded.textures.every((t) => t.compressed && t.mips >= 10)).toBe(
      true,
    );
    expect(decoded.textures.find((t) => t.colorSpace === "srgb").width).toBe(
      size,
    );
  }
  expect(decoderRequests).toHaveLength(2);
  expect(decoderRequests.every((r) => r.status === 200)).toBe(true);
  expect(errors).toEqual([]);
});
