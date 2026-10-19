import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

async function open(page, reference = false) {
  await page.goto(
    `/tests/maps/fixtures/outlineCache.html${reference ? "?reference" : ""}`,
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
  expect(first.calls).toBeGreaterThan(100);
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
test("cached output preserves the previous outline colours and occlusion, and cuts repeated draw work", async ({
  page,
  browser,
}) => {
  test.skip(
    !fs.existsSync(
      path.resolve(
        import.meta.dirname,
        "../../target/tileOutline-before-cache.js",
      ),
    ),
    "Local pre-change renderer used for comparison",
  );
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
  expect(visual.big).toBe(0);
  expect(visual.mean).toBeLessThan(0.05);
  const cached = await page.evaluate(() => window.outlineCache.frame("light"));
  expect(cached.calls).toBeLessThan(reference.calls / 20);
  console.log(
    JSON.stringify({
      outlineBenchmark: {
        referenceCalls: reference.calls,
        firstCachedFrameCalls: first.calls,
        cachedCalls: cached.calls,
        referenceTriangles: reference.triangles,
        cachedTriangles: cached.triangles,
        visual,
      },
    }),
  );
  await before.close();
});
