import { test, expect } from '@playwright/test';

async function point(page, x, y) {
  const b = await page.locator('.map-canvas-surface').boundingBox();
  const s = Math.min((b.width - 24) / 12, (b.height - 24) / 10);
  return { x: b.x + b.width / 2 + (x - 6) * s, y: b.y + b.height / 2 + (y - 5) * s };
}
async function ready(page, mode = '') {
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.goto(`/tests/maps/fixtures/maps.html${mode ? '?mode=' + mode : ''}`);
  await expect(page.locator('.map-canvas canvas')).toBeVisible();
  await expect(page.getByText('Подготавливаем карту…')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
}
test('editor paints, undoes, saves versions and creates zones', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready(page, 'editor');
  const p = await point(page, 3.5, 3.5);
  await page.mouse.click(p.x, p.y);
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.cells['3,3']))
    .toBe('wall-stone');
  await page.getByTitle('Отменить · Ctrl/Cmd+Z').click();
  await expect
    .poll(() => page.evaluate(() => window.lastSaved?.document.cells['3,3']))
    .toBeUndefined();
  await page.getByRole('radio', { name: 'Зоны', exact: true }).click();
  await page.getByRole('button', { name: 'Новая зона', exact: true }).click();
  const a = await point(page, 2, 2),
    b = await point(page, 4, 4);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.lastSaved?.document.zones.length)).toBe(3);
  expect(await page.evaluate(() => window.lastSaved.document.zones[2].rects.length)).toBe(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
for (const mobile of [false, true])
  test(`table controls and physical tokens ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
    await page.setViewportSize(
      mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
    );
    await ready(page);
    await page.getByLabel('Видимость зоны Хранилище').selectOption('explored');
    await expect
      .poll(() => page.evaluate(() => window.latestBoard.state.zones.right))
      .toBe('explored');
    await page.getByRole('radio', { name: 'Жетоны', exact: true }).click();
    await page.getByRole('button', { name: 'Следопыт', exact: true }).click();
    await page.getByRole('switch', { name: 'Физическая миниатюра' }).click();
    await expect
      .poll(() => page.evaluate(() => window.latestBoard.state.tokens[0].physical))
      .toBe(true);
    await page.getByRole('radio', { name: 'Стол', exact: true }).click();
    await page.getByRole('switch', { name: 'Вписывать всю карту' }).click();
    await expect.poll(() => page.evaluate(() => window.latestDisplay.camera.fit)).toBe(false);
    await page.getByRole('button', { name: 'Затемнить экран', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.latestDisplay.visible)).toBe(false);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
test('tokens drag and doors open without changing the document', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready(page);
  const a = await point(page, 3.5, 3.5),
    b = await point(page, 4.5, 4.5);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.latestBoard.state.tokens[0].x)).toBe(4.5);
  const door = await point(page, 6, 5);
  await page.mouse.click(door.x, door.y);
  await expect.poll(() => page.evaluate(() => window.latestBoard.state.objects.door)).toBe(true);
  expect(await page.evaluate(() => window.latestBoard.document.objects[0].open)).toBe(false);
});
test('standalone map display renders without master controls', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await ready(page, 'screen');
  await expect(page.getByRole('button', { name: 'Транслировать карту' })).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
});

for (const kind of ['image-grid', 'image'])
  test(`${kind} keeps the background fixed and edits rectangular zones`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await ready(page, `editor&kind=${kind}`);
    await expect(page.getByRole('radio', { name: 'Кисть', exact: true })).toHaveCount(0);
    const p = await point(page, 3.5, 3.5);
    await page.mouse.click(p.x, p.y);
    await page.getByRole('radio', { name: 'Зоны', exact: true }).click();
    await page.getByRole('button', { name: 'Новая зона', exact: true }).click();
    const a = await point(page, 2.2, 2.2),
      b = await point(page, 4.2, 4.2);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => window.lastSaved?.document.zones.length)).toBe(3);
    const d = await page.evaluate(() => window.lastSaved.document);
    expect(d.cells).toEqual({});
    expect(d.background.url).toBe('/maps/city.svg');
    expect(d.zones[2].rects[0].x).toBeCloseTo(kind === 'image' ? 2.2 : 2, 1);
  });

test('failed session writes retain changes and retry with the original version', async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    window.failNextSave = 500;
  });
  await page.getByLabel('Видимость зоны Хранилище').selectOption('explored');
  await expect(page.getByRole('alert')).toContainText('Нет связи');
  await expect(page.getByLabel('Видимость зоны Хранилище')).toHaveValue('explored');
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.latestBoard.state.zones.right))
    .toBe('explored');
  const versions = await page.evaluate(() =>
    window.requests.filter((r) => r.url.endsWith('/maps/test-map')).map((r) => r.data.revision),
  );
  expect(versions).toEqual([1, 1]);
});

test('conflicting writes require an explicit reload before replacing local changes', async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    window.failNextSave = 409;
  });
  await page.getByLabel('Видимость зоны Хранилище').selectOption('explored');
  await expect(page.getByRole('alert')).toContainText('другой вкладке');
  await expect(page.getByLabel('Видимость зоны Хранилище')).toHaveValue('explored');
  await page.getByRole('button', { name: 'Загрузить с сервера', exact: true }).click();
  await page.getByRole('button', { name: 'Загрузить', exact: true }).click();
  await expect(page.getByLabel('Видимость зоны Хранилище')).toHaveValue('hidden');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
