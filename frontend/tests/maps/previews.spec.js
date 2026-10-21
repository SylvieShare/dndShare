import { test, expect } from "@playwright/test";

test("opening a saved map with anchored flames does not PUT the document", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto(
    "/tests/maps/fixtures/maps.html?mode=editor&componentsExample&sixFires&serverLights",
  );
  await expect(page.locator(".map-canvas-surface canvas")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.loadedModels.length))
    .toBeGreaterThan(0);
  await page.clock.runFor(3000);
  expect(
    await page.evaluate(() =>
      window.requests.filter((request) => request.url === "/api/maps/test-map"),
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page
    .getByRole("switch", { name: "Показывать сетку", exact: true })
    .click();
  await page.clock.runFor(1300);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.requests.filter(
            (request) => request.url === "/api/maps/test-map",
          ).length,
      ),
    )
    .toBe(1);
});

test("editor saves a preview without fetching context and never polls the model catalogue", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await expect(page.locator(".map-canvas-surface canvas")).toBeVisible();
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page
    .getByRole("switch", { name: "Показывать сетку", exact: true })
    .click();
  await page.clock.runFor(1300);
  await expect.poll(() => page.evaluate(() => !!window.lastSaved)).toBe(true);
  await page.clock.runFor(8100);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.requests.filter((r) => r.data?.preview).length,
      ),
    )
    .toBe(1);
  const reads = await page.evaluate(
    () =>
      window.mapReadRequests.filter((url) => url === "/api/maps/models").length,
  );
  expect(
    await page.evaluate(
      () =>
        window.mapReadRequests.filter((url) => url.endsWith("/preview-context"))
          .length,
    ),
  ).toBe(0);
  await page.clock.runFor(120000);
  expect(
    await page.evaluate(
      () =>
        window.mapReadRequests.filter((url) => url === "/api/maps/models")
          .length,
    ),
  ).toBe(reads);
});

test("public map does not periodically reload model metadata", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/tests/maps/fixtures/maps.html?mode=screen");
  await expect(page.locator(".map-canvas-surface canvas")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.loadedModels.length))
    .toBeGreaterThan(0);
  const count = await page.evaluate(
    () =>
      window.mapReadRequests.filter((url) => url.endsWith("/map-models"))
        .length,
  );
  await page.clock.runFor(120000);
  expect(
    await page.evaluate(
      () =>
        window.mapReadRequests.filter((url) => url.endsWith("/map-models"))
          .length,
    ),
  ).toBe(count);
});

test("stale cards keep their saved picture while a new preview is being generated", async ({
  page,
}) => {
  await page.goto("/tests/maps/fixtures/maps.html?mode=library&tagsExample");
  const image = page.locator(".map-thumbnail img").first();
  await expect(image).toBeVisible({ timeout: 20000 });
  await expect
    .poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.requests.filter((r) => r.data?.preview).length,
      ),
    )
    .toBe(3);
  const previous = await image.getAttribute("src");
  await page.evaluate(() => {
    const key = "fixture-document:" + location.search;
    const document = structuredClone(window.templateMap.document);
    document.grid.visible = !document.grid.visible;
    sessionStorage.setItem(key, JSON.stringify(document));
  });
  await page.addInitScript(() => {
    window.holdPreviewContexts = true;
  });
  await page.reload();
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", previous);
  await expect
    .poll(() => page.evaluate(() => window.pendingPreviewContexts?.length || 0))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.loadedModels.length)).toBe(0);
  await page.evaluate(() => {
    window.holdPreviewContexts = false;
    window.pendingPreviewContexts.splice(0).forEach((resolve) => resolve());
  });
  await expect(image).not.toHaveAttribute("src", previous, { timeout: 20000 });
});

test("a snapshot renders one world frame and uses smaller shadow maps", async ({
  page,
}) => {
  await page.route(
    "**/src/features/maps/rendering/mapRenderer.js",
    async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        "host.appendChild(gpu.domElement);",
        `
      host.appendChild(gpu.domElement);
      window.snapshotTest = {gpu,scene,frames:0};
      const originalRender = gpu.render.bind(gpu);
      gpu.render = (world, view) => {
        if(world === scene) window.snapshotTest.frames++;
        return originalRender(world,view);
      };`,
      );
      await route.fulfill({ response, body });
    },
  );
  await page.goto(
    "/tests/maps/fixtures/maps.html?mode=header&lightExample&lit",
  );
  await page.waitForFunction(() => !!window.templateMap);
  const result = await page.evaluate(async () => {
    const { createMapRenderer } = await import(
      "/src/features/maps/rendering/mapRenderer.js"
    );
    const { getMapModels } = await import("/src/shared/api/mapsApi.js");
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;left:-10000px;width:420px;height:280px";
    document.body.append(host);
    const renderer = await createMapRenderer(
      host,
      () => {},
      undefined,
      undefined,
      { snapshotOnly: true },
    );
    await renderer.update(window.templateMap.document, null, {
      catalogue: await getMapModels(),
      animate: false,
      master: true,
    });
    const blob = await renderer.snapshot();
    renderer.setActive(false);
    renderer.setActive(true);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const shadows = [];
    window.snapshotTest.scene.traverse((node) => {
      if (node.isLight && node.shadow?.map)
        shadows.push({
          cube: !!node.shadow.map.isWebGLCubeRenderTarget,
          size: node.shadow.map.width,
        });
    });
    const frames = window.snapshotTest.frames;
    renderer.destroy();
    host.remove();
    return { frames, shadows, mime: blob.type, bytes: blob.size };
  });
  expect(result.frames).toBe(1);
  expect(result.mime).toBe("image/webp");
  expect(result.bytes).toBeGreaterThan(100);
  expect(result.shadows).toContainEqual({ cube: true, size: 256 });
});
