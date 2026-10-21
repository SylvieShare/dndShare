import { expect } from '@playwright/test'

export async function raster(page, type = 'image/png', width = 32, height = 16) {
  return Buffer.from(await page.evaluate(async ({ type, width, height }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d')
    context.fillStyle = '#ac5cfa'; context.fillRect(0, 0, width / 2, height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type))
    return [...new Uint8Array(await blob.arrayBuffer())]
  }, { type, width, height }))
}

export async function captureUploads(page, pattern = '**/api/storage/images') {
  const uploads = []
  await page.route(pattern, async route => {
    const request = route.request()
    const form = await new Request('http://upload.test', {
      method: 'POST', headers: { 'content-type': request.headers()['content-type'] }, body: request.postDataBuffer(),
    }).formData()
    const file = form.get('file')
    uploads.push({ name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) })
    await route.fulfill({ json: { upload_id: 101, url: '/test-global-world.svg', iconImageId: 101, iconImageUrl: '/test-global-world.svg' } })
  })
  return uploads
}

export async function expectWebp(page, upload, width, height, transparent = false) {
  expect(upload.type).toBe('image/webp')
  expect(upload.name).toMatch(/\.webp$/)
  expect(upload.bytes.subarray(0, 4).toString()).toBe('RIFF')
  expect(upload.bytes.subarray(8, 12).toString()).toBe('WEBP')
  const result = await page.evaluate(async bytes => {
    const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/webp' }))
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
    const alpha = context.getImageData(image.width - 1, 0, 1, 1).data[3]
    const dimensions = { width: image.width, height: image.height, alpha }; image.close()
    return dimensions
  }, [...upload.bytes])
  expect([result.width, result.height]).toEqual([width, height])
  if (transparent) expect(result.alpha).toBe(0)
}
