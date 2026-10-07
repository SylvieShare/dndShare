import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { dragTile } from "./editorHelpers";

async function point(page, x, y) {
  const b = await page.locator(".map-canvas-surface").boundingBox();
  const s = Math.min((b.width - 40) / 12, (b.height - 40) / 10);
  return {
    x: b.x + b.width / 2 + (x - 6) * s,
    y: b.y + b.height / 2 + (y - 5) * s,
  };
}
async function ready(page, mode = "") {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto(
    `/tests/maps/fixtures/maps.html${mode ? "?mode=" + mode : ""}`,
  );
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.getByText("Подготавливаем карту…")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  const top = page.getByTitle("Вид сверху", { exact: true });
  if (await top.count()) await top.click();
}
test("editor drops tiles, undoes and autosaves versions without zone controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready(page, "editor");
  const p = await point(page, 3.5, 3.5);
  await dragTile(page, p);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find((t) => t.x === 3 && t.y === 3)
            ?.modelId,
      ),
    )
    .toBe("22222222-2222-4222-8222-222222222222");
  await page.getByTitle("Отменить · Ctrl/Cmd+Z").click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find((t) => t.x === 3 && t.y === 3)
            ?.modelId,
      ),
    )
    .toBeUndefined();
  await expect(
    page.getByRole("button", { name: "Зоны", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await expect(
    page.getByLabel("Последнее сохранение", { exact: true }).locator("time"),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
for (const mobile of [false, true])
  test(`table controls and physical tokens ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
    );
    await ready(page);
    await page.getByRole("button", { name: "Области", exact: true }).click();
    await page.getByRole("switch", { name: "Показывать Хранилище", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.latestBoard.state.zones.right))
      .toBe("visible");
    await page.getByRole("button", { name: "Жетоны", exact: true }).click();
    await page.getByRole("button", { name: "Следопыт", exact: true }).click();
    await page.getByRole("switch", { name: "Физическая миниатюра" }).click();
    await expect
      .poll(() =>
        page.evaluate(() => window.latestBoard.state.tokens[0].physical),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Трансляция", exact: true }).click();
    await page.getByRole("switch", { name: "Вписывать всю карту" }).click();
    await expect
      .poll(() => page.evaluate(() => window.latestDisplay.camera.fit))
      .toBe(false);
    await page
      .getByRole("button", { name: "Затемнить экран", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.latestDisplay.visible))
      .toBe(false);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
test("tokens drag and doors open without changing the document", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready(page);
  const a = await point(page, 3.5, 3.5),
    b = await point(page, 4.5, 4.5);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.latestBoard.state.tokens[0].x))
    .toBe(4.5);
  const door = await point(page, 6, 5);
  await page.mouse.click(door.x, door.y);
  await expect
    .poll(() => page.evaluate(() => window.latestBoard.state.objects.door))
    .toBe(true);
  expect(
    await page.evaluate(() => window.latestBoard.document.objects[0].open),
  ).toBe(false);
});
test("standalone map display renders without master controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await ready(page, "screen");
  await expect(
    page.getByRole("button", { name: "Транслировать карту" }),
  ).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);
});

for (const kind of ["image-grid", "image"])
  test(`${kind} keeps its background and existing fog zones while editor zone tools are absent`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await ready(page, `editor&kind=${kind}`);
    await expect(
      page.getByRole("button", { name: "Зоны", exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("Название карты", { exact: true }).fill("Новый фон");
    await page.getByLabel("Название карты", { exact: true }).blur();
    await expect
      .poll(() => page.evaluate(() => window.lastSaved?.name))
      .toBe("Новый фон");
    const d = await page.evaluate(() => window.lastSaved.document);
    expect(d.tiles).toEqual([]);
    expect(d.background.url).toBe("/maps/city.svg");
    expect(d.zones).toHaveLength(2);
  });

test("failed session writes retain changes and retry with the original version", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    window.failNextSave = 500;
  });
  await page.getByRole("button", { name: "Области", exact: true }).click();
  await page.getByRole("switch", { name: "Показывать Хранилище", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Нет связи");
  await expect(page.getByRole("switch", { name: "Показывать Хранилище", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.latestBoard.state.zones.right))
    .toBe("visible");
  const versions = await page.evaluate(() =>
    window.requests
      .filter((r) => r.url.endsWith("/maps/test-map"))
      .map((r) => r.data.revision),
  );
  expect(versions).toEqual([1, 1]);
});

test("conflicting writes require an explicit reload before replacing local changes", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    window.failNextSave = 409;
  });
  await page.getByRole("button", { name: "Области", exact: true }).click();
  await page.getByRole("switch", { name: "Показывать Хранилище", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("другой вкладке");
  await expect(page.getByRole("switch", { name: "Показывать Хранилище", exact: true })).toBeChecked();
  await page
    .getByRole("button", { name: "Загрузить с сервера", exact: true })
    .click();
  await page.getByRole("button", { name: "Загрузить", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Показывать Хранилище", exact: true })).not.toBeChecked();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("editor rotates a dragged tile before placing and deletes it from its menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready(page, "editor");
  const p = await point(page, 4.5, 4.5);
  await dragTile(page, p, { rotate: true });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find((t) => t.x === 4 && t.y === 4)
            ?.rotation,
      ),
    )
    .toBe(90);
  await page.mouse.click(p.x, p.y);
  await page
    .getByRole("button", { name: "Удалить плитку", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.lastSaved?.document.tiles.find((t) => t.x === 4 && t.y === 4),
      ),
    )
    .toBeUndefined();
});

test("real compressed model uses the same editor and shader when local assets exist", async ({
  page,
}) => {
  const assets = path.resolve(
    import.meta.dirname,
    "../../../models/prepared/runtime",
  );
  test.skip(
    !fs.existsSync(path.join(assets, "LC-001.render.glb")),
    "Local model files are intentionally excluded from Git",
  );
  const errors = [];
  let modelRequests = 0;
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/api/maps/models/*/*", async (route) => {
    modelRequests++;
    const parts = new URL(route.request().url()).pathname.split("/");
    const code = parts[4].startsWith("1111") ? "LC-001" : "LC-007";
    await route.fulfill({
      path: path.join(
        assets,
        `${code}.${parts[5] === "lod" ? "lod" : "render"}.glb`,
      ),
      contentType: "model/gltf-binary",
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready(page, "editor&realModels");
  const p = await point(page, 4.5, 4.5);
  await dragTile(page, p);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lastSaved?.document.tiles.find((t) => t.x === 4 && t.y === 4)
            ?.modelId,
      ),
    )
    .toBe("22222222-2222-4222-8222-222222222222");
  expect(errors.filter((e) => /THREE|WebGL|shader|decode/i.test(e))).toEqual(
    [],
  );
  expect(modelRequests).toBeGreaterThan(0);
});
