export async function dragTile(
  page,
  point,
  { name = "Пол 1", rotate = false } = {},
) {
  const card = await page
    .getByRole("button", { name, exact: true })
    .boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 12 });
  if (rotate) await page.keyboard.press("r");
  await page.mouse.up();
}
export async function mapPoint(page, x, y) {
  const b = await page.locator(".map-canvas-surface").boundingBox();
  const s = Math.min((b.width - 40) / 12, (b.height - 40) / 10);
  return {
    x: b.x + b.width / 2 + (x - 6) * s,
    y: b.y + b.height / 2 + (y - 5) * s,
  };
}
