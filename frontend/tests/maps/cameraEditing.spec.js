import { test, expect } from '@playwright/test'
import { mapPoint } from './editorHelpers'

for (const mode of ['editor', 'board'])
  test(`camera inspector and separate surface focus dragging in ${mode}`, async ({
    page,
  }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`/tests/maps/fixtures/maps.html?mode=${mode}`)
    await expect(page.locator('.map-canvas canvas')).toBeVisible()
    await page.getByRole('button', { name: 'Камеры', exact: true }).click()
    await page
      .getByRole('button', { name: 'Добавить камеру', exact: true })
      .click()
    const saved = () =>
      page.evaluate(
        (mode) => (mode === 'editor' ? window.lastSaved : window.latestBoard),
        mode,
      )
    await expect
      .poll(async () => (await saved())?.document.cameras?.length)
      .toBe(1)
    const original = (await saved()).document.cameras[0]
    const panel = page.getByRole('complementary', {
      name: 'Выбранные элементы',
    })
    await expect(panel.locator('.inspector-entity-heading')).toHaveCount(1)
    await expect(panel.locator('.inspector-preview-frame')).toHaveCount(1)
    await expect(panel.getByRole('slider')).toHaveCount(2)
    await expect(panel.locator('input[type=number]')).toHaveCount(0)
    await expect(
      panel.getByRole('region', { name: 'Точка взгляда', exact: true }),
    ).toHaveCount(0)
    await expect(panel).not.toContainText('Меньше ширина')
    const colours = await panel
      .getByRole('button', { name: 'Удалить камеру', exact: true })
      .locator('svg')
      .evaluate((svg) => {
        const reference = document.createElement('span')
        reference.style.color = 'var(--danger)'
        document.body.append(reference)
        const result = [
          getComputedStyle(svg).color,
          getComputedStyle(reference).color,
        ]
        reference.remove()
        return result
      })
    expect(colours[0]).toBe(colours[1])
    await panel
      .getByRole('button', { name: 'Изменить название камеры', exact: true })
      .click()
    await panel.getByLabel('Название камеры', { exact: true }).fill('Балкон')
    await panel
      .getByRole('button', { name: 'Сохранить название', exact: true })
      .click()
    await expect
      .poll(async () => (await saved())?.document.cameras?.[0]?.name)
      .toBe('Балкон')
    await page.getByTitle('Вид сверху', { exact: true }).click()
    const body = await mapPoint(
      page,
      original.view.position[0],
      original.view.position[1],
    )
    const target = await mapPoint(
      page,
      original.view.target[0],
      original.view.target[1],
    )
    const markerState = () =>
      page.locator('.map-canvas').evaluate((el) => {
        const p = el.__vueParentComponent.props
        return {
          hovered: p.hoveredCamera,
          part: p.hoveredCameraPart,
          dragging: p.draggingCameraPart,
          preview: p.previewCamera,
        }
      })
    await page.mouse.move(body.x, body.y)
    await expect.poll(async () => (await markerState()).part).toBe('body')
    await page.mouse.move(target.x, target.y)
    await expect.poll(async () => (await markerState()).part).toBe('target')
    await page.mouse.down()
    await page.waitForTimeout(550)
    await expect.poll(async () => (await markerState()).dragging).toBe('target')
    const barrel = await mapPoint(page, 3, 6)
    await page.mouse.move(barrel.x, barrel.y, { steps: 8 })
    await expect
      .poll(async () => (await markerState()).preview?.view.target[2] || 0)
      .toBeGreaterThan(0.5)
    await page.mouse.up()
    await expect
      .poll(
        async () => (await saved())?.document.cameras?.[0]?.view.target[2] || 0,
      )
      .toBeGreaterThan(0.5)
    const moved = (await saved()).document.cameras[0]
    expect(moved.view.position).toEqual(original.view.position)
    expect(moved.view.target[0]).toBeCloseTo(3, 1)
    expect(moved.view.target[1]).toBeCloseTo(6, 1)
    await page.locator('.map-canvas-surface').focus()
    await page.keyboard.press('Control+z')
    await expect
      .poll(async () => (await saved())?.document.cameras?.[0]?.view.target)
      .toEqual(original.view.target)
    await page.keyboard.press('Control+Shift+z')
    await expect
      .poll(async () => (await saved())?.document.cameras?.[0]?.view.target)
      .toEqual(moved.view.target)
    expect(errors).toEqual([])
  })

test('camera inspector keeps the shared layout within a mobile viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 932 })
  await page.goto('/tests/maps/fixtures/maps.html?mode=editor')
  await expect(page.locator('.map-canvas canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Камеры', exact: true }).click()
  await page
    .getByRole('button', { name: 'Добавить камеру', exact: true })
    .click()
  const panel = page.getByRole('complementary', { name: 'Выбранные элементы' })
  await expect(
    panel.getByRole('heading', { name: 'Камера 1', exact: true }),
  ).toBeVisible()
  await expect(panel.getByRole('slider')).toHaveCount(2)
  await expect(
    panel.getByRole('button', { name: 'Удалить камеру', exact: true }),
  ).toBeVisible()
  await expect
    .poll(() =>
      panel.evaluate((el) => {
        const bounds = el.getBoundingClientRect()
        return (
          bounds.left >= 0 &&
          bounds.right <= window.innerWidth &&
          el.scrollWidth <= el.clientWidth
        )
      }),
    )
    .toBe(true)
})
