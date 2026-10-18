import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("fading instanced tiles and multipart objects never expose their inner triangles", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /WebGL|Shader|GL_INVALID/.test(message.text())
    )
      errors.push(message.text());
  });
  await page.goto("/tests/maps/fixtures/areaSurfaces.html");
  await page.waitForFunction(() => window.areaSurfaces?.ready);
  for (const cloud of [false, true]) {
    for (const opacity of [1, 0.5, 0.12]) {
      for (const angle of [45, 135, 225, 315]) {
        const difference = await page.evaluate(
          (options) => window.areaSurfaces.compare(options),
          { cloud, opacity, angle },
        );
        expect(
          difference.changed,
          JSON.stringify({ cloud, opacity, angle, difference }),
        ).toBe(0);
      }
    }
  }
  const sample = (opacity, position) =>
    page.evaluate(
      ({ opacity, position }) => {
        window.areaSurfaces.frame({ opacity });
        return window.areaSurfaces.sample(position);
      },
      { opacity, position },
    );
  const surface = [1.6, 0.4, 0.5],
    foreground = [0.5, 0.7, 0.5];
  const solid = await sample(1, surface),
    faded = await sample(0.5, surface),
    hidden = await sample(0, surface);
  expect(faded[0]).toBeGreaterThan(hidden[0] + 30);
  expect(faded[0]).toBeLessThan(solid[0] - 30);
  expect(await sample(0.5, foreground)).toEqual(await sample(1, foreground));
  expect(errors).toEqual([]);
});

test("real MT1-037 fades only the visible surface instead of its dark mounting geometry", async ({
  page,
}) => {
  const model = path.resolve(
    import.meta.dirname,
    "../../../models/collections/medieval-town-vol1/upload/MT1-037/f0555e1f177c12edfe5f31af1f89ee2f9dc52e6ac9efe986e61e3e8c4dc34794.glb",
  );
  test.skip(!fs.existsSync(model), "Local model assets are excluded from Git");
  await page.route("**/test-model.glb", (route) =>
    route.fulfill({ path: model, contentType: "model/gltf-binary" }),
  );
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tests/maps/fixtures/areaSurfacesReal.html");
  await page.waitForFunction(() => window.realSurfaces?.ready);
  const before = await page.evaluate(() =>
    window.realSurfaces.compare(0.5, 45, true),
  );
  expect(before.changed).toBeGreaterThan(1000);
  for (const opacity of [0.5, 0.12]) {
    for (const angle of [45, 135, 225, 315]) {
      const result = await page.evaluate(
        ({ opacity, angle }) => window.realSurfaces.compare(opacity, angle),
        { opacity, angle },
      );
      expect(
        result.changed,
        JSON.stringify({ opacity, angle, result }),
      ).toBeLessThan(100);
    }
  }
  expect(errors).toEqual([]);
});
