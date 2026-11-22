import { test, expect } from '@playwright/test'
import { sessionLayout } from './fixtures/session-layout.js'

test('the starter chapter and scene are editable before adding covers', async ({ page }) => {
  await page.setViewportSize({ width: 704, height: 932 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const chapter = {
    id: 12, arcId: 3, number: '1', name: 'Начало истории', status: 'none',
    imageId: 0, imageUrl: '', positionX: 0, positionY: 80, imageFocalX: .5, imageFocalY: .5, sceneCount: 1,
  }
  const scene = {
    id: 31, chapterId: 12, name: 'Первая сцена', status: 'none',
    imageId: null, imageUrl: '', locationId: null, positionX: 0, positionY: 0,
  }
  const block = { id: 41, sceneId: 31, type: 'text', title: 'Описание сцены', data: { text: '' }, width: 300, positionX: 0, positionY: 0 }
  await sessionLayout(page, {
    url: '/sessions/test',
    navigate: async path => {
      await page.route('**/api/sessions/test', route => route.fulfill({
        json: { session: { uuid: 'test', name: 'Приключение', ownerUserId: 1, systemId: 1, sourceVersionId: 1,
          status: 'stopped', displayCode: 'TEST', currentChapterId: chapter.id }, myRole: 'gm', participants: [] },
      }))
      await page.route('**/api/sessions/test/chapter-graph', route => route.fulfill({
        json: { arcs: [{ id: 3, name: 'Основная арка', order: 1 }], chapters: [chapter], edges: [] },
      }))
      await page.route('**/api/session-images?scope=story', route => route.fulfill({
        json: { images: [{ id: 501, key: 'city', label: 'Город', url: '/static/tab-stats.svg' }] },
      }))
      await page.route('**/api/sessions/test/chapters/12/scene-graph', route => route.fulfill({ json: { scenes: [scene], edges: [] } }))
      await page.route('**/api/sessions/test/scenes/31/block-graph', route => route.fulfill({ json: { scene, items: [block], edges: [] } }))
      for (const [endpoint, entry] of [['chapters/12', chapter], ['scenes/31', scene]]) {
        await page.route(`**/api/sessions/test/${endpoint}`, route => {
          Object.assign(entry, route.request().postDataJSON())
          return route.fulfill({ json: entry })
        })
      }
      await page.goto(path)
    },
  })

  const chapterCard = page.locator('.chapter-node').filter({ hasText: 'Начало истории' })
  await expect(chapterCard).toContainText('Сейчас здесь')
  await expect(chapterCard).toContainText('1 сцена')
  await chapterCard.click()
  const chapterMenu = page.getByRole('menu', { name: 'Действия с главой 1' })
  await chapterMenu.getByRole('menuitem', { name: 'Редактировать', exact: true }).click()
  const chapterEditor = page.getByRole('dialog', { name: 'Редактировать главу' })
  await chapterEditor.getByRole('textbox', { name: 'Название' }).fill('Пролог')
  await chapterEditor.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(chapterEditor).toHaveCount(0)
  expect(chapter.imageId).toBe(0)
  await page.getByRole('button', { name: 'Пролог', exact: true }).press('Enter')
  await chapterMenu.getByRole('menuitem', { name: /Открыть сценарии/ }).click()

  await page.locator('.scene-graph-node').filter({ hasText: 'Первая сцена' }).click()
  const sceneMenu = page.locator('.scene-graph-menu')
  await sceneMenu.getByRole('menuitem', { name: 'Редактировать', exact: true }).click()
  const sceneEditor = page.getByRole('dialog', { name: 'Редактировать сценарий' })
  await sceneEditor.getByPlaceholder('Название сценария').fill('Встреча')
  await sceneEditor.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(sceneEditor).toHaveCount(0)
  expect([scene.imageId, scene.locationId]).toEqual([null, null])
  await page.getByRole('button', { name: 'Встреча', exact: true }).press('Enter')
  await sceneMenu.getByRole('menuitem', { name: 'Открыть элементы', exact: true }).click()
  const description = page.locator('.scene-block-node')
  await expect(description).toHaveCount(1)
  await expect(description).toContainText('Описание сцены')
})
