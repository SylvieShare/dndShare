import { expect, test } from '@playwright/test'

test('автор задаёт бонус инициативы, сохраняет предмет и получает тот же результат после открытия', async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.goto('/tests/game-mechanics/editor.html')
  await page.getByRole('button', { name: 'Добавить зависимость' }).click()
  await page.getByRole('button', { name: /Изменение показателя/ }).click()
  await page.getByLabel('Что изменить', { exact: true }).selectOption('check_bonus')
  await page.getByLabel('Величина', { exact: true }).fill('3')
  await page.getByLabel('Ограничить виды бросков', { exact: true }).click()
  await page.getByLabel('Инициатива', { exact: true }).click()
  await page.getByRole('button', { name: 'Сохранить предмет' }).click()
  await page.reload()
  await expect(page.getByLabel('Инициатива на листе')).toHaveText('3')
  await expect(page.getByLabel('Проверка на листе')).toHaveText('0')
  await expect(page.getByLabel('Инициатива', { exact: true })).toBeChecked()
})
