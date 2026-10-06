export async function pickTile(page, name = "Пол 1") {
  await page.getByRole("tab", { name: "Предметы", exact: true }).click();
  const kind = await page.evaluate(
    async (name) =>
      (await (await fetch("/api/maps/models")).json()).find(
        (m) => m.name === name,
      )?.tileType,
    name,
  );
  const labels = {
    floor: "Пол",
    "wall-straight": "Прямые стены",
    "wall-angle": "Внутренние углы (Angle)",
    "wall-tee": "Т-образные стены",
    "wall-cross": "Х-образные стены",
    "wall-end": "Выступы и окончания стен",
    "wall-corner": "Наружные углы (Corner)",
    "wall-diagonal": "Диагональные стены",
    stairs: "Лестницы",
    frame: "Каркасы",
    prop: "Декор",
  };
  await page
    .getByRole("toolbar", { name: "Типы тайлов" })
    .getByRole("button", {
      name: labels[kind],
      exact: true,
    })
    .click();
  await page.getByRole("button", { name, exact: true }).click();
}
export async function dragTile(
  page,
  point,
  { name = "Пол 1", rotate = false } = {},
) {
  await pickTile(page, name);
  await page.mouse.move(point.x, point.y, { steps: 12 });
  if (rotate) await page.keyboard.press("r");
  await page.mouse.click(point.x, point.y);
}
export async function mapPoint(page, x, y) {
  const b = await page.locator(".map-canvas-surface").boundingBox();
  const s = Math.min((b.width - 40) / 12, (b.height - 40) / 10);
  return {
    x: b.x + b.width / 2 + (x - 6) * s,
    y: b.y + b.height / 2 + (y - 5) * s,
  };
}

export async function choosePack(page, id) {
  const names = {
    "lost-cave": "Lost Cave",
    "ultimate-dungeon": "Ultimate Dungeon",
  };
  await page.getByRole("combobox", { name: "Пак тайлов", exact: true }).click();
  await page.getByRole("option", { name: names[id], exact: true }).click();
}
