// Focused checks for this design prototype only. No product services are used.
const { chromium } = require(
  process.env.RED_PLAYWRIGHT ||
    "C:/Projects/dndshare/frontend/node_modules/@playwright/test",
);
const fs = require("node:fs");
const path = require("node:path");
const out = path.join(__dirname, "screenshots");
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const errors = [];
  const results = [];
  for (const [name, width, height] of [
    ["phone", 390, 844],
    ["tablet", 840, 1000],
    ["desktop", 1440, 1000],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:8766/screen.html");
    await page.screenshot({
      path: path.join(out, `sheet-${name}.png`),
      fullPage: true,
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    if (overflow) throw new Error(`${name}: horizontal overflow`);
    for (const tab of [
      "skills",
      "combat",
      "cyber",
      "net",
      "gear",
      "role",
      "life",
      "journal",
    ]) {
      await page.locator(`[data-tab="${tab}"]`).first().click();
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw new Error(`${name}/${tab}: overflow`);
    }
    await page.locator("#journal").fill("Проверка сохранения");
    await page.locator('[data-action="save-note"]').click();
    await page.reload();
    if ((await page.locator("#journal").inputValue()) !== "Проверка сохранения")
      throw new Error("Draft lost");
    await page.locator('[data-view="wizard"]').click();
    if (width < 721) {
      await page.locator('[data-action="steps"]').click();
      await page.locator('#dialog [data-step="1"]').click();
    } else await page.locator('[data-step="1"]').click();
    await page.locator('[data-role="solo"]').click();
    await page.screenshot({
      path: path.join(out, `wizard-${name}.png`),
      fullPage: true,
    });
    await page.locator('[data-action="next"]').click();
    await page.locator('[data-action="next"]').click();
    await page.locator('[data-stat="INT"]').fill("8");
    await page.locator('[data-stat="INT"]').blur();
    await page.locator('[data-action="next"]').click();
    if (!(await page.locator('[data-stat="INT"]').count()))
      throw new Error("Invalid budget accepted");
    await page.locator('[data-stat="INT"]').fill("7");
    await page.locator('[data-stat="INT"]').blur();
    for (let i = 0; i < 5; i++)
      await page.locator('[data-action="next"]').click();
    if (
      (await page
        .locator('[data-view="sheet"]')
        .getAttribute("aria-pressed")) !== "true"
    )
      throw new Error("Wizard did not finish");
    await page.locator('[data-tab="combat"]').click();
    await page.locator('[data-roll="Тяжёлый пистолет"]').click();
    await page.locator("#roll-submit").click();
    if (!(await page.locator(".roll-result").textContent()))
      throw new Error("No roll result");
    await page.locator(".close").click();
    await page.locator('[data-view="catalog"]').click();
    await page.screenshot({
      path: path.join(out, `catalog-${name}.png`),
      fullPage: true,
    });
    results.push({
      name,
      width,
      height,
      overflow: false,
      tabs: 9,
      wizard: "passed",
      roll: "passed",
      draft: "passed",
    });
    await page.close();
  }
  for (const width of [320, 599, 600, 1199, 1200]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto("http://127.0.0.1:8766/screen.html");
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error(`Boundary ${width} overflow`);
    await page.close();
  }
  await browser.close();
  if (errors.length) throw new Error(errors.join("\n"));
  fs.writeFileSync(
    path.join(out, "checks.json"),
    JSON.stringify(
      { results, errors, boundaries: [320, 599, 600, 1199, 1200] },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ results, errors }));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
