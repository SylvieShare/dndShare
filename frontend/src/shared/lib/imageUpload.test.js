import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canvasToWebp, prepareImageUpload, validateImageFile, IMAGE_UPLOAD_MAX_BYTES } from './imageUpload'

describe('image preparation', () => {
  let canvas, context, image
  beforeEach(() => {
    context = { drawImage: vi.fn() }
    canvas = { getContext: () => context, toBlob: callback => callback(new Blob(['encoded'], { type: 'image/webp' })) }
    vi.stubGlobal('document', { createElement: () => canvas })
    vi.stubGlobal('Image', class {
      naturalWidth = 1200
      naturalHeight = 800
      constructor() { image = this }
      set src(value) { if (value) queueMicrotask(() => this.onload?.()) }
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:source')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('accepts original files through 30 MiB and rejects larger files before decoding', async () => {
    expect(() => validateImageFile({ size: 30 * 1024 * 1024, type: 'image/png' })).not.toThrow()
    await expect(prepareImageUpload({ size: IMAGE_UPLOAD_MAX_BYTES + 1, type: 'image/png' })).rejects.toThrow('30 МБ')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
  it('rejects empty and non-image files', () => {
    expect(() => validateImageFile({ size: 0, type: 'image/png' })).toThrow('непустое')
    expect(() => validateImageFile({ size: 10, type: 'text/plain' })).toThrow('файл изображения')
  })
  it('passes WebP through unchanged, avoiding quality loss', async () => {
    const file = new File(['original'], 'world.webp', { type: 'image/webp' })
    expect(await prepareImageUpload(file)).toBe(file)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
  it('converts at the original resolution and replaces the filename extension', async () => {
    const file = await prepareImageUpload(new File(['png'], 'map.v2.png', { type: 'image/png', lastModified: 123 }))
    expect([file.name, file.type, file.lastModified]).toEqual(['map.v2.webp', 'image/webp', 123])
    expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0, 1200, 800)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:source')
    expect([canvas.width, canvas.height]).toEqual([0, 0])
  })
  it('bounds the wizard icon without changing aspect ratio', async () => {
    await prepareImageUpload(new File(['png'], 'icon.png', { type: 'image/png' }), { maxDimension: 256 })
    expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0, 256, 171)
  })
  it('reports unsupported formats and releases the source', async () => {
    vi.stubGlobal('Image', class { set src(value) { if (value) queueMicrotask(() => this.onerror?.()) } })
    await expect(prepareImageUpload(new File(['broken'], 'map.png', { type: 'image/png' }))).rejects.toThrow('Не удалось открыть')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:source')
  })
  it('rejects unsupported WebP dimensions before allocating a canvas', async () => {
    const pending = prepareImageUpload(new File(['png'], 'map.png', { type: 'image/png' }))
    image.naturalWidth = 16384
    await expect(pending).rejects.toThrow('16383')
    expect(context.drawImage).not.toHaveBeenCalled()
  })
  it('checks the encoded size too', async () => {
    canvas.toBlob = callback => callback(new Blob([new Uint8Array(100)], { type: 'image/webp' }))
    await expect(prepareImageUpload(new File(['png'], 'map.png', { type: 'image/png' }), { maxBytes: 10 })).rejects.toThrow('После преобразования')
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })
  it.each([null, new Blob(['png'], { type: 'image/png' })])('rejects a missing encoder or a silent PNG fallback', async blob => {
    canvas.toBlob = callback => callback(blob)
    await expect(canvasToWebp(canvas)).rejects.toThrow('WebP')
  })
})
