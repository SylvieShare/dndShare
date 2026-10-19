import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { localModelAsset } from "../../../scripts/maps/local_model_assets.mjs";
test("decodes both reviewed tiers and preserves dedicated shadows under sun and point lights", async ({
  page,
}) => {
  test.setTimeout(90000);
  const directory = process.env.MAP_REVIEW_TEST_ASSETS;
  test.skip(!directory, "One locally reviewed model directory is required");
  const report = JSON.parse(
      fs.readFileSync(path.join(directory, "report.json"), "utf8"),
    ),
    shadow = report.preparedShadow
      ? path.join(directory, path.basename(report.preparedShadow.asset.key))
      : await localModelAsset(report.model.assets.shadow),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/model-review/*.glb", (route) =>
    route.fulfill({
      path:
        path.basename(route.request().url()) === "shadow.glb"
          ? shadow
          : path.join(directory, path.basename(route.request().url())),
      contentType: "model/gltf-binary",
    }),
  );
  await page.goto("/tests/maps/fixtures/modelReview.html");
  await page.waitForFunction(() => window.reviewModel);
  for (const tier of ["render", "lod"]) {
    const result = await page.evaluate(
      ({ tier, model }) => window.reviewModel(tier, model),
      { tier, model: report.model },
    );
    expect(result.triangles).toBe(report.resourceMetrics[tier].triangles);
    expect(result.shadowTriangles).toBe(
      report.resourceMetrics.shadow.triangles,
    );
    // Opaque shadows can intentionally exclude a visible flame. Compare with
    // the reviewed shadow bounds rather than assuming they equal the LOD.
    const a = report.resourceMetrics[tier].bounds,
      b = report.resourceMetrics.shadow.bounds;
    const acceptedDrift = Math.max(
      ...["min", "max"].flatMap((side) =>
        a[side].map((v, i) => Math.abs(v - b[side][i])),
      ),
    );
    expect(result.drift).toBeLessThan(acceptedDrift + 0.0002);
    expect(result.rendered).toBeGreaterThan(0);
    if (report.tiers[tier].textureCount === 0) {
      expect(result.textures).toEqual([]);
      expect(result.materials.length).toBeGreaterThan(0);
      const uniform = report.tiers[tier].uniformMaterial;
      for (const material of result.materials) {
        material.color.forEach((value, i) =>
          expect(value).toBeCloseTo(uniform.linear[i], 5),
        );
        expect(material.roughness).toBeCloseTo(uniform.roughness, 5);
        expect(material.metallic).toBeCloseTo(uniform.metallic, 5);
      }
    } else {
      expect(result.textures.find((t) => t.colorSpace === "srgb").width).toBe(
        report.tiers[tier].textureSize,
      );
    }
    expect(
      result.shadowChecks.every((c) => c.changed > 50),
      JSON.stringify(result.shadowChecks),
    ).toBe(true);
    if (report.proceduralFire) expect(result.emissionMaps).toEqual([]);
    if (report.materialSpec?.torch?.emission && !report.proceduralFire)
      expect(result.emissionMaps).toEqual([
        { width: report.tiers[tier].textureSize, colorSpace: "srgb" },
      ]);
  }
  expect(errors).toEqual([]);
});
