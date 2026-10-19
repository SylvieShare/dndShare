import { expect, test } from "@playwright/test";

async function open(page, reference = false) {
  await page.goto(
    `/tests/maps/fixtures/outlineCache.html${reference ? "?depthReference" : ""}`,
  );
  await page.waitForFunction(() => window.outlineCache);
}
test("caches the mask and edge filter across light frames, invalidates all geometry changes, and removes stale outlines", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /WebGL|THREE|shader/i.test(m.text()))
      errors.push(m.text());
  });
  await open(page);
  const first = await page.evaluate(() => window.outlineCache.frame());
  expect(first.calls).toBeGreaterThan(1);
  for (let i = 0; i < 5; i++) {
    const cached = await page.evaluate(() =>
      window.outlineCache.frame("light"),
    );
    expect(cached.calls).toBe(1);
    expect(cached.triangles).toBe(2);
    expect(cached.textures).toBe(first.textures);
  }
  for (const change of [
    "move",
    "occlude",
    "hide",
    "camera",
    "palette",
    "geometry",
    "hover",
    "invalid",
    "resize",
    "dpr",
  ]) {
    expect(
      (
        await page.evaluate(
          (change) => window.outlineCache.frame(change),
          change,
        )
      ).calls,
    ).toBeGreaterThan(1);
    expect(
      await page.evaluate(() => window.outlineCache.compareFresh()),
    ).toMatchObject({ changed: 0, max: 0, cachedCalls: 1 });
  }
  expect(
    (await page.evaluate(() => window.outlineCache.frame("clear"))).calls,
  ).toBe(0);
  expect(
    (await page.evaluate(() => window.outlineCache.frame("restore"))).calls,
  ).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test("shader-deformed occluders update shared-depth contours only while overlapping the mask", async ({
  page,
}) => {
  await page.goto("/tests/maps/fixtures/outlineCache.html?animated");
  await page.waitForFunction(() => window.outlineCache);
  await page.evaluate(() => window.outlineCache.frame());
  expect(
    (await page.evaluate(() => window.outlineCache.frame("shader"))).calls,
  ).toBeGreaterThan(1);
  expect(
    await page.evaluate(() => window.outlineCache.compareFresh()),
  ).toMatchObject({ changed: 0, max: 0 });
  await page.evaluate(() => window.outlineCache.frame("shaderFar"));
  expect(
    (await page.evaluate(() => window.outlineCache.frame("shader"))).calls,
  ).toBe(1);
});

test("shared MSAA depth is recreated after context loss", async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.outlineCache.frame());
  const restored = await page.evaluate(() =>
    window.outlineCache.restoreContext(),
  );
  test.skip(!restored, "Context restoration unavailable");
  expect(
    (await page.evaluate(() => window.outlineCache.frame())).calls,
  ).toBeGreaterThan(1);
  expect(
    await page.evaluate(() => window.outlineCache.compareFresh()),
  ).toMatchObject({ changed: 0, max: 0 });
});
test("cached output preserves the previous outline colours and occlusion, and cuts repeated draw work", async ({
  page,
  browser,
}) => {
  const before = await browser.newPage();
  await open(before, true);
  await open(page);
  const reference = await before.evaluate(() => window.outlineCache.frame()),
    first = await page.evaluate(() => window.outlineCache.frame());
  const oldPixels = await before.evaluate(() => window.outlineCache.pixels());
  const visual = await page.evaluate((old) => {
    const current = window.outlineCache.pixels();
    let maximum = 0,
      big = 0,
      sum = 0;
    for (let i = 0; i < old.length; i++) {
      const d = Math.abs(old[i] - current[i]);
      maximum = Math.max(maximum, d);
      if (d > 4) big++;
      sum += d;
    }
    return { maximum, big, mean: sum / old.length };
  }, oldPixels);
  const cached = await page.evaluate(() => window.outlineCache.frame("light"));
  expect(cached.calls).toBeLessThan(reference.calls / 20);
  expect(first.calls).toBeLessThan(reference.calls / 3);
  expect(first.totalCalls).toBeLessThan(reference.totalCalls);
  expect(first.totalTriangles).toBeLessThan(reference.totalTriangles);
  console.log(
    JSON.stringify({
      outlineBenchmark: {
        referenceCalls: reference.calls,
        firstCachedFrameCalls: first.calls,
        firstCachedFrameTriangles: first.triangles,
        previousTotalCalls: reference.totalCalls,
        sharedDepthTotalCalls: first.totalCalls,
        cachedCalls: cached.calls,
        referenceTriangles: reference.triangles,
        cachedTriangles: cached.triangles,
        visual,
      },
    }),
  );
  expect(visual.big).toBeLessThanOrEqual(4);
  expect(visual.mean).toBeLessThan(0.05);
  await before.close();
});

test("cropped masks follow moving instance matrices instead of retaining their original bounding box", async ({
  page,
}) => {
  await page.goto("/tests/maps/fixtures/outlineCache.html?instances");
  await page.waitForFunction(() => window.outlineCache);
  await page.evaluate(() => window.outlineCache.frame());
  expect(
    (await page.evaluate(() => window.outlineCache.frame("instanceMove")))
      .calls,
  ).toBeGreaterThan(1);
  expect(
    await page.evaluate(() => window.outlineCache.compareFresh()),
  ).toMatchObject({ changed: 0, max: 0, cachedCalls: 1 });
  await page.evaluate(() => window.outlineCache.frame("camera"));
  expect(
    await page.evaluate(() => window.outlineCache.compareFresh()),
  ).toMatchObject({ changed: 0, max: 0, cachedCalls: 1 });
});
