import { test, expect } from "@playwright/test";

async function ready(page, mobile = false) {
  await page.setViewportSize(
    mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
  );
  await page.goto("/tests/maps/fixtures/maps.html?mode=editor");
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  return page.getByRole("navigation", { name: "Боковые вкладки редактора" });
}

test("tab hover uses an outline and cannot cover the travelling selection square", async ({
  page,
}) => {
  const nav = await ready(page),
    tiles = nav.getByRole("button", { name: "Плитки", exact: true });
  const rail = await nav.boundingBox(),
    button = await tiles.boundingBox();
  expect(button.x - rail.x).toBeGreaterThanOrEqual(4);
  expect(rail.x + rail.width - button.x - button.width).toBeGreaterThanOrEqual(
    4,
  );
  await page.mouse.move(800, 20);
  const normal = await tiles.screenshot();
  await tiles.hover();
  expect((await tiles.screenshot()).equals(normal)).toBe(true);
  const hovered = nav.getByRole("button", { name: "Объекты", exact: true });
  await hovered.hover();
  await expect(hovered).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const outlined = await hovered.evaluate((node) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--border-strong)";
    node.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
  await expect(hovered).toHaveCSS("border-top-color", outlined);
  // Hold the active square underneath a different, hovered tab.
  await hovered.evaluate(async (button) => {
    const indicator = document.querySelector(".map-sidebar-indicator");
    await new Promise((resolve) => {
      function hold(event) {
        if (event.propertyName !== "transform") return;
        indicator.removeEventListener("transitionrun", hold);
        const animation = indicator
          .getAnimations()
          .find((a) => a.transitionProperty === "transform");
        animation.pause();
        let low = 0,
          high = animation.effect.getTiming().duration;
        for (let i = 0; i < 20; i++) {
          animation.currentTime = (low + high) / 2;
          if (
            indicator.getBoundingClientRect().y <
            button.getBoundingClientRect().y
          )
            low = animation.currentTime;
          else high = animation.currentTime;
        }
        resolve();
      }
      indicator.addEventListener("transitionrun", hold);
      document
        .querySelector('.map-sidebar-tabs [aria-label="Области"]')
        .click();
    });
  });
  const image = await hovered.screenshot();
  const colours = await page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(
      new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
        type: "image/png",
      }),
    );
    const canvas = new OffscreenCanvas(48, 48),
      context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const actual = [...context.getImageData(8, 8, 1, 1).data].slice(0, 3);
    const probe = document.createElement("span");
    probe.style.color = "var(--accent)";
    document.body.append(probe);
    const expected = getComputedStyle(probe)
      .color.match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number);
    probe.remove();
    return { actual, expected };
  }, image.toString("base64"));
  for (let i = 0; i < 3; i++)
    expect(
      Math.abs(colours.actual[i] - colours.expected[i]),
    ).toBeLessThanOrEqual(1);
  await page
    .locator(".map-sidebar-indicator")
    .evaluate((node) => node.getAnimations().forEach((a) => a.finish()));
});

for (const [mobile, reduced] of [
  [false, false],
  [true, false],
  [false, true],
]) {
  test(`column width animates and revealing another tab never flies from the previous selection (${mobile}, ${reduced})`, async ({
    page,
  }) => {
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    const nav = await ready(page, mobile),
      sidebar = page.locator(".map-sidebar");
    await nav.getByRole("button", { name: "Настройки", exact: true }).click();
    const expandedWidth = mobile ? 330 : 334;
    await expect
      .poll(async () => (await sidebar.boundingBox()).width)
      .toBe(expandedWidth);
    await expect(
      page.getByLabel("Название карты", { exact: true }),
    ).toBeVisible();
    const collapse = await page
      .getByRole("button", { name: "Свернуть панель карты", exact: true })
      .evaluate(async (button) => {
        const sidebar = button.closest(".map-sidebar"),
          panel = sidebar.querySelector(".map-sidebar-panel");
        const result = { animated: false, during: 0, inert: false };
        function sample(event) {
          if (event.target !== sidebar || event.propertyName !== "width")
            return;
          const animation = sidebar
            .getAnimations()
            .find((a) => a.transitionProperty === "width");
          animation.pause();
          animation.currentTime = animation.effect.getTiming().duration / 2;
          result.animated = true;
          result.during = sidebar.getBoundingClientRect().width;
          result.inert = panel.inert;
          animation.finish();
        }
        sidebar.addEventListener("transitionrun", sample);
        button.click();
        for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
        sidebar.removeEventListener("transitionrun", sample);
        return result;
      });
    expect(collapse.animated).toBe(!reduced);
    if (!reduced) {
      expect(collapse.during).toBeGreaterThan(60);
      expect(collapse.during).toBeLessThan(expandedWidth);
      expect(collapse.inert).toBe(true);
    }
    await expect.poll(async () => (await sidebar.boundingBox()).width).toBe(60);
    const reveal = await nav
      .getByRole("button", { name: "Освещение", exact: true })
      .evaluate(async (button) => {
        const sidebar = button.closest(".map-sidebar"),
          indicator = sidebar.querySelector(".map-sidebar-indicator");
        let flights = 0;
        const record = (event) => {
          if (event.propertyName === "transform") flights++;
        };
        indicator.addEventListener("transitionrun", record);
        button.click();
        await new Promise(requestAnimationFrame);
        const content = sidebar.querySelector(".map-sidebar-content");
        const firstFrame = {
          oldVisible:
            content?.dataset.tab === "settings" &&
            getComputedStyle(content).visibility !== "hidden",
          offset:
            indicator.getBoundingClientRect().y -
            button.getBoundingClientRect().y,
        };
        for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
        const animated = sidebar
          .getAnimations()
          .some((a) => a.transitionProperty === "width");
        indicator.removeEventListener("transitionrun", record);
        return { ...firstFrame, flights, animated };
      });
    expect(reveal.oldVisible).toBe(false);
    expect(Math.abs(reveal.offset)).toBeLessThan(1);
    expect(reveal.flights).toBe(0);
    expect(reveal.animated).toBe(!reduced);
    await expect
      .poll(async () => (await sidebar.boundingBox()).width)
      .toBe(expandedWidth);
    await expect(
      page.getByRole("region", { name: "Освещение карты" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Название карты", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".map-sidebar-content")).toHaveCount(1);
  });
}
