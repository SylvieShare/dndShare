import { readFileSync } from 'node:fs'
import { fixture } from '../../tutorials/fixtures/character-layout.js'

const release = JSON.parse(readFileSync(new URL('../../../../release/versions.json', import.meta.url), 'utf8'))
export const fullPhoto = readFileSync(new URL('../../../public/static/game-context/dnd-logo.webp', import.meta.url))
export const legacyPhoto = readFileSync(new URL('../../../public/favicon-32.png', import.meta.url))
export const fullPhotoName = 'Галерея-проверка.webp'

export async function installGalleryDownload(page) {
  const api = await fixture(page)
  api.document().values.person_photos = [
    { uid: 'full', imageId: 801, url: '/gallery-full.webp', thumbnailUrl: '/gallery-thumb.png', name: 'Галерея-проверка.jpg' },
    { uid: 'legacy', url: '/gallery-legacy.png' },
  ]
  let status = 200
  await page.route('**/api/storage/images/801', route => status === 200
    ? route.fulfill({ contentType: 'image/webp', body: fullPhoto })
    : route.fulfill({ status, body: '' }))
  await page.route('**/gallery-full.webp', route => route.fulfill({ contentType: 'image/webp', body: fullPhoto }))
  await page.route(/\/gallery-(thumb|legacy)\.png$/, route => route.fulfill({ contentType: 'image/png', body: legacyPhoto }))
  await page.route('**/api/build-info', route => route.fulfill({
    json: { backend: { ...release.backend, apiContract: release.contracts.api }, frontend: release.frontend },
  }))
  await page.route('**/api/handbook/sync?**', route => route.fulfill({
    json: { protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [], metadata: { types: [], suggests: {}, suggestTypes: {}, books: [] } },
  }))
  return { ...api, setStatus: value => { status = value } }
}
