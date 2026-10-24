import fs from 'node:fs'

// Keep the mocked catalogue's byte contract consistent with the actual GLBs.
export async function localModelAssets(page, files, onRequest = () => {}) {
  const sizes = Object.fromEntries(Object.entries(files).map(([kind, tiers]) =>
    [kind, Object.fromEntries(Object.entries(tiers).map(([tier, file]) => [tier, fs.statSync(file).size]))]))
  await page.addInitScript(value => { window.fixtureModelAssetBytes = value }, sizes)
  let requests = 0
  await page.route('**/api/maps/models/*/*', async route => {
    requests++
    const parts = new URL(route.request().url()).pathname.split('/')
    const group = parts[4].startsWith('1111') ? 'wall' : parts[4].startsWith('ffff') && files.chest ? 'chest' : 'floor'
    const tier = parts[5] === 'lod' ? 'lod' : parts[5] === 'shadow' ? 'shadow' : 'render'
    onRequest(tier)
    await route.fulfill({ path: files[group][tier], contentType: 'model/gltf-binary' })
  })
  return () => requests
}
