import { test, expect } from "@playwright/test";
import { mapPoint } from "./editorHelpers";
const focusPanel = (page) =>
  page.getByRole("complementary", { name: "Выбранные элементы" });
async function ready(page, extra) {
  await page.goto(`/tests/maps/fixtures/maps.html?mode=editor${extra}`);
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
}
async function blueAtCentre(page) {
  const png = await page.locator(".map-canvas canvas").screenshot();
  const canvasBox = await page.locator(".map-canvas canvas").boundingBox(),
    panelBox = await focusPanel(page).boundingBox(),
    sidebarBox = await page.locator(".map-sidebar").boundingBox();
  const left = Math.max(canvasBox.x, sidebarBox.x + sidebarBox.width);
  const focusX = (left + panelBox.x) / 2 - canvasBox.x;
  return page.evaluate(
    async ({ base64, focusX }) => {
      const image = await createImageBitmap(
        new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
          type: "image/png",
        }),
      );
      const c = new OffscreenCanvas(image.width, image.height).getContext("2d");
      c.drawImage(image, 0, 0);
      const pixels = c.getImageData(
        Math.floor(focusX) - 20,
        Math.floor(image.height / 2) - 20,
        40,
        40,
      ).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] < 140 && pixels[i + 1] > 170 && pixels[i + 2] > 220)
          count++;
      return count;
    },
    { base64: png.toString("base64"), focusX },
  );
}
for (const mobile of [false, true])
  test(`shared icon buttons animate their slash and help collapses ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
    );
    await ready(page, "&lightExample&lit");
    await page.getByRole("button", { name: "Освещение", exact: true }).click();
    const lights = page.getByRole("region", { name: "Освещение карты" });
    const button = lights.getByRole("button", {
      name: "Выключить свет: Факел",
      exact: true,
    });
    const slash = button.locator(".share-icon-toggle__slash path");
    await expect(button).toHaveClass(/share-icon-toggle/);
    await button.click();
    const off = lights.getByRole("button", {
      name: "Включить свет: Факел",
      exact: true,
    });
    await expect(off).toHaveAttribute("aria-pressed", "false");
    expect(
      await off
        .locator(".share-icon-toggle__slash path")
        .evaluate((p) => parseFloat(getComputedStyle(p).transitionDuration)),
    ).toBeGreaterThan(0);
    await expect
      .poll(() =>
        off
          .locator(".share-icon-toggle__slash path")
          .evaluate((p) => parseFloat(getComputedStyle(p).strokeDashoffset)),
      )
      .toBe(0);
    await off.click();
    await expect
      .poll(() =>
        slash.evaluate((p) => parseFloat(getComputedStyle(p).strokeDashoffset)),
      )
      .toBe(1);
    await expect(
      lights.getByRole("button", {
        name: "Выключить тени: Факел",
        exact: true,
      }),
    ).toHaveCount(0);
    const commands = page.getByRole("list", {
      name: "Команды управления картой",
    });
    await expect(commands).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Управление картой", exact: true }),
    ).toHaveCount(0);
    await commands.click();
    const help = page.getByRole("button", {
      name: "Управление картой",
      exact: true,
    });
    await expect(help).toHaveAttribute("aria-expanded", "false");
    await expect(commands).toHaveCount(0);
    await help.click();
    await expect(commands).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Управление картой", exact: true }),
    ).toHaveCount(0);
  });
test("builtin lights expose editable effects, retain model identity, inherit area and focus smoothly from both previews", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready(page, "&transitions");
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  const lights = page.getByRole("region", { name: "Освещение карты" });
  const row = lights.getByRole("button", {
    name: "Стена 1 · Встроенный факел",
    exact: true,
  });
  await row.click();
  const panel = focusPanel(page);
  await expect(
    panel.getByRole("button", {
      name: "Изменить название источника света",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("heading", {
      name: "Стена 1 · Встроенный факел",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", {
      name: "Привязка к модели фиксирована",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    panel
      .getByRole("region", { name: "Область", exact: true })
      .getByRole("combobox"),
  ).toHaveCount(0);
  await panel
    .getByRole("slider", { name: "Высота", exact: true })
    .fill("2.4");
  await panel
    .getByRole("button", { name: "Показать сферу источника", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Включить тени", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Выключить мерцание", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Цвет источника света", exact: true })
    .click();
  await page.getByRole("button", { name: "#68cfff", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.lights.find(
            (l) => l.builtinKey === "flame",
          )?.overrides,
      ),
    )
    .toEqual({
      height: 2.4,
      showMarker: true,
      shadows: true,
      flicker: false,
      color: "#68cfff",
    });
  await expect(panel.locator("table")).toHaveCount(0);
  const frame = await panel.locator(".map-selected-visual").boundingBox(),
    actions = await panel
      .getByRole("group", { name: "Действия источника света" })
      .boundingBox();
  expect(actions.y).toBeGreaterThan(frame.y + frame.height);
  const headings = await panel
    .getByRole("heading", { level: 4 })
    .allTextContents();
  expect(headings.indexOf("Привязка")).toBeLessThan(
    headings.indexOf("Область"),
  );
  const rightLine = panel
    .locator(".map-panel-heading .share-section-label")
    .first();
  expect(
    await rightLine.evaluate((el) => getComputedStyle(el).borderTopWidth),
  ).toBe("0px");
  expect(
    await rightLine.evaluate((el) => getComputedStyle(el).borderBottomWidth),
  ).toBe("0px");
  await row.dblclick();
  await expect.poll(() => blueAtCentre(page)).toBeGreaterThan(8);
  const canvas = await page.locator(".map-canvas-surface").boundingBox();
  await page.mouse.move(
    canvas.x + canvas.width * 0.7,
    canvas.y + canvas.height * 0.6,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvas.x + canvas.width * 0.7 + 130,
    canvas.y + canvas.height * 0.6,
    { steps: 4 },
  );
  await page.mouse.up();
  await expect.poll(() => blueAtCentre(page)).toBe(0);
  await panel
    .getByRole("button", {
      name: "Приблизить источник: Стена 1 · Встроенный факел",
      exact: true,
    })
    .dblclick();
  await expect.poll(() => blueAtCentre(page)).toBeGreaterThan(8);
});
test("a third local source retains its shadows and shows a performance notice", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("Shader"))
      errors.push(m.text());
  });
  await ready(page, "&lightExample&lit");
  await page.getByTitle("Вид сверху", { exact: true }).click();
  await page.getByRole("button", { name: "Освещение", exact: true }).click();
  const lights = page.getByRole("region", { name: "Освещение карты" });
  for (let i = 0; i < 2; i++) {
    await lights
      .getByRole("button", { name: "Добавить источник света", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Факел", exact: true }).click();
    const p = await mapPoint(page, 4.5 + i, 5.5);
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
  }
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.lights.filter(
            (l) => l.enabled && l.shadows,
          ).length,
      ),
    )
    .toBe(3);
  await expect(
    lights.getByText("Локальных источников с тенями: 3", { exact: true }),
  ).toBeVisible();
  await expect(
    lights.getByText("Много источников с тенями могут замедлить карту.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("unbinding an attached light uses a cross and slides the row out before undo restores it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready(page, "&transitions");
  await page.getByTitle("Вид сверху", { exact: true }).click();
  const p = await mapPoint(page, 4.5, 4.5);
  await page.mouse.click(p.x, p.y);
  const lights = focusPanel(page).getByRole("region", {
    name: "Освещение выбранной модели",
  });
  const row = lights.getByRole("button", {
    name: "Стена 1 · Прикреплённая лампа",
    exact: true,
  });
  const container = row.locator("..");
  await container
    .getByRole("button", {
      name: "Отвязать Стена 1 · Прикреплённая лампа",
      exact: true,
    })
    .click();
  await expect(container).toHaveClass(/map-attached-light-leave-active/);
  await expect
    .poll(() => container.evaluate((el) => getComputedStyle(el).transform), {
      intervals: [16, 32],
    })
    .not.toBe("none");
  await expect(row).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.lights.find(
            (l) => l.id === "attached-lamp",
          )?.anchor || null,
      ),
    )
    .toBe(null);
  await page.locator(".map-canvas-surface").focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(
    lights.getByRole("button", {
      name: "Стена 1 · Прикреплённая лампа",
      exact: true,
    }),
  ).toBeVisible();
});
