import { test, expect } from '@playwright/test'

for (const live of [false, true])
  for (const mode of ['owner', 'dm'])
    test(`sheet modal persists edits for ${mode} with live=${live}`, async ({
      page,
    }) => {
      page.on('pageerror', (error) => {
        throw error
      })
      await page.goto(
        `/tests/tutorials/fixtures/character-sheet-save.html?${mode === 'dm' ? 'other&dm&' : ''}${live ? 'live' : ''}`,
      )
      await expect(page.locator('.dci-name')).toHaveText('Торин')
      await rename(page, 'Новое имя')
      await expect(page.locator('.dci-name')).toHaveText('Новое имя')
      await expect
        .poll(() => page.evaluate(() => window.savedCharacter.data.values.name))
        .toBe('Новое имя')
      expect(
        await page.evaluate(() => window.characterRequests.length),
      ).toBeGreaterThan(0)
    })

async function rename(page, name) {
  await page.locator('.dci-edit').click()
  const editor = page.getByRole('dialog', { name: 'Персонаж', exact: true })
  await editor.getByPlaceholder('Имя персонажа').fill(name)
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click()
}

for (const mode of ['owner', 'dm'])
  test(`closing ${mode} sheet during a save sends the newer queued edit`, async ({
    page,
  }) => {
    page.on('pageerror', (error) => {
      throw error
    })
    await page.goto(
      `/tests/tutorials/fixtures/character-sheet-save.html?live&${mode === 'dm' ? 'other&dm' : ''}`,
    )
    await expect(page.locator('.dci-name')).toHaveText('Торин')
    await page.evaluate(() => {
      window.holdCharacterResponse = true
    })
    await rename(page, 'Первое имя')
    await page.waitForFunction(() => window.releaseCharacterResponse)
    await rename(page, 'Последнее имя')
    await page.locator('.csm .tb-back').click()
    await expect(page.locator('.csm')).toHaveCount(0)
    await page.evaluate(() => window.releaseCharacterResponse())
    await expect
      .poll(() => page.evaluate(() => window.savedCharacter.data.values.name))
      .toBe('Последнее имя')
    await page
      .getByRole('button', { name: 'Открыть лист', exact: true })
      .click()
    await expect(page.locator('.dci-name')).toHaveText('Последнее имя')
  })

for (const query of ['other&live', 'preview&live'])
  test(`read-only sheet does not send writes: ${query}`, async ({ page }) => {
    await page.goto(
      `/tests/tutorials/fixtures/character-sheet-save.html?${query}`,
    )
    await expect(page.locator('.dci-name')).toHaveText('Торин')
    await expect(page.locator('.dci-edit')).toHaveCount(0)
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => window.characterRequests)).toEqual([])
  })
