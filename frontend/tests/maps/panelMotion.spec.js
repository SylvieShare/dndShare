import { test, expect } from "@playwright/test";

async function ready(page, mode = "editor") {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(
    `/tests/maps/fixtures/maps.html?mode=${mode}&areaExample&attachmentExample&creatures`,
  );
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
}
async function switchTab(page, label) {
  return page
    .getByRole("navigation", { name: "Боковые вкладки редактора" })
    .getByRole("button", { name: label, exact: true })
    .evaluate(async (button) => {
      const indicator = document.querySelector(".map-sidebar-indicator");
      const before = indicator.getBoundingClientRect().y;
      const target = button.getBoundingClientRect().y;
      const outgoing = document.querySelector(".map-sidebar-content");
      const result = {
        before,
        target,
        middle: before,
        animated: false,
        direction: 0,
        inert: false,
      };
      function sample(event) {
        if (event.propertyName !== "transform") return;
        const animation = event.target
          .getAnimations()
          .find((a) => a.transitionProperty === "transform");
        if (!animation) return;
        animation.pause();
        animation.currentTime = animation.effect.getTiming().duration / 2;
        if (event.target === indicator) {
          result.animated = true;
          result.middle = indicator.getBoundingClientRect().y;
        } else if (event.target === outgoing) {
          result.direction = new DOMMatrix(
            getComputedStyle(outgoing).transform,
          ).m42;
          result.inert = outgoing.inert;
        }
        animation.finish();
      }
      indicator.addEventListener("transitionrun", sample);
      outgoing.addEventListener("transitionrun", sample);
      button.click();
      for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
      indicator.removeEventListener("transitionrun", sample);
      outgoing.removeEventListener("transitionrun", sample);
      return result;
    });
}
test("the active square travels between tabs and pages move in the matching direction without retaining stale tabs", async ({
  page,
}) => {
  await ready(page);
  const down = await switchTab(page, "Области");
  expect(down.animated).toBe(true);
  expect(down.middle).toBeGreaterThan(down.before);
  expect(down.middle).toBeLessThan(down.target);
  expect(down.direction).toBeLessThan(0);
  expect(down.inert).toBe(true);
  await expect(
    page.getByRole("region", { name: "Области карты" }),
  ).toBeVisible();
  await page.waitForFunction(
    () =>
      !document.querySelector(".map-sidebar-content").getAnimations().length,
  );
  const up = await switchTab(page, "Плитки");
  expect(up.middle).toBeLessThan(up.before);
  expect(up.middle).toBeGreaterThan(up.target);
  expect(up.direction).toBeGreaterThan(0);
  await page.evaluate(() => {
    for (const name of ["Освещение", "Объекты", "Области", "Настройки"])
      document
        .querySelector(`.map-sidebar-tabs [aria-label="${name}"]`)
        .click();
  });
  await expect(
    page.getByLabel("Название карты", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".map-sidebar-content")).toHaveCount(1);
  await expect(page.locator(".map-sidebar-content")).toHaveAttribute(
    "data-tab",
    "settings",
  );
});

test("focus fades in and out, retains its frame during entity changes and disables departing controls", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Области", exact: true }).click();
  const row = page
    .getByRole("region", { name: "Области карты" })
    .getByRole("button", { name: "Зал", exact: true });
  const enter = await row.evaluate(async (button) => {
    button.click();
    for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
    const panel = document.querySelector(".map-selection-panel"),
      fade = panel
        .getAnimations()
        .find((a) => a.transitionProperty === "opacity");
    if (fade) {
      fade.pause();
      fade.currentTime = fade.effect.getTiming().duration / 2;
    }
    const result = {
      opacity: Number(getComputedStyle(panel).opacity),
      animated: !!fade,
    };
    fade?.finish();
    return result;
  });
  expect(enter.animated).toBe(true);
  expect(enter.opacity).toBeGreaterThan(0);
  expect(enter.opacity).toBeLessThan(1);
  const panel = page.getByRole("complementary", { name: "Выбранные элементы" });
  await expect(
    panel.getByRole("heading", { name: "Зал", exact: true }),
  ).toBeVisible();
  const swap = await panel
    .getByRole("button", { name: "Сундук", exact: true })
    .evaluate(async (button) => {
      const panel = button.closest(".map-selection-panel"),
        before = panel.getBoundingClientRect();
      const departing = panel.querySelector(".workspace-focus-view");
      button.click();
      for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
      return {
        sameFrame: panel === document.querySelector(".map-selection-panel"),
        before: before.height,
        during: panel.getBoundingClientRect().height,
        inert: departing.inert,
        animated: departing
          .getAnimations()
          .some((a) => a.transitionProperty === "opacity"),
      };
    });
  expect(swap.sameFrame).toBe(true);
  expect(swap.inert).toBe(true);
  expect(swap.animated).toBe(true);
  expect(swap.during).toBeGreaterThan(swap.before - 2);
  await expect(
    panel.getByRole("heading", { name: "Сундук", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.locator(".map-selection-panel")).toHaveCount(0);
});

for (const reduced of [false, true])
  test(`session creature focus swaps animate and respect reduced motion (${reduced})`, async ({
    page,
  }) => {
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await ready(page, "board");
    const tab = await switchTab(page, "Существа");
    expect(tab.animated).toBe(!reduced);
    const roster = page.getByRole("region", { name: "Существа сессии" });
    await roster.getByRole("button", { name: "Лира", exact: true }).click();
    const panel = page.getByRole("complementary", {
      name: "Выбранные элементы",
    });
    await expect(
      panel.getByRole("heading", { name: "Лира", exact: true }),
    ).toBeVisible();
    const animated = await roster
      .getByRole("button", { name: "A · Огр", exact: true })
      .evaluate(async (button) => {
        button.click();
        for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
        return !!document.querySelector(".workspace-focus-swap-leave-active[inert]");
      });
    expect(animated).toBe(!reduced);
    await expect(
      panel.getByRole("heading", { name: "A · Огр", exact: true }),
    ).toBeVisible();
    if (reduced)
      expect(
        await panel.evaluate(
          (node) => node.getAnimations({ subtree: true }).length,
        ),
      ).toBe(0);
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
  });
