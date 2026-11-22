import { readFileSync } from 'node:fs'
import { initialState, newMap } from '../../../src/features/maps/lib/mapModel.js'
import { sessionLayout } from './session-layout.js'

const release = JSON.parse(readFileSync(new URL('../../../../release/versions.json', import.meta.url), 'utf8'))

export async function sessionMapControls(page, navigate = path => page.goto(path)) {
  const maps = [
    { ...newMap(), id: 'hall', name: 'Зал', revision: 1, state: initialState() },
    { ...newMap(), id: 'crypt', name: 'Склеп', revision: 1, state: initialState() },
  ]
  const imageMap = { ...newMap(), id: 'plan', name: 'План', revision: 1, state: initialState() }
  imageMap.document.kind = 'image'
  imageMap.document.image = {
    id: 1, url: '/static/tab-stats.svg', pixelWidth: 600, pixelHeight: 400, cellPixels: 50, offsetX: 0, offsetY: 0,
  }
  maps.push(imageMap)
  let display = { mapId: 'hall', visible: true, revision: 1, camera: { x: 6, y: 5, cellPixels: 64, rotation: 0, fit: true } }
  const broadcasts = []
  await sessionLayout(page, {
    url: '/sessions/test?view=maps',
    navigate: async path => {
      await page.route('**/api/build-info', route => route.fulfill({
        json: { backend: { ...release.backend, apiContract: release.contracts.api }, frontend: release.frontend },
      }))
      await page.route('**/api/maps/models', route => route.fulfill({ json: [] }))
      await page.route('**/api/sessions/test/maps', route => route.fulfill({ json: { maps, display } }))
      await page.route('**/api/sessions/test/map-display', route => {
        display = { ...route.request().postDataJSON(), revision: display.revision + 1 }
        broadcasts.push(display)
        return route.fulfill({ json: display })
      })
      await navigate(path)
    },
  })
  return { broadcasts }
}
