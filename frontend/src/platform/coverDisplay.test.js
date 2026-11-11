import { beforeEach, expect, it, vi } from 'vitest'
const native = vi.hoisted(() => ({ addListener: vi.fn(), getStatus: vi.fn(), show: vi.fn(), hide: vi.fn() }))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => native }))
vi.mock('./storage', () => ({ isAndroid: true }))
vi.mock('../shared/lib/imageUpload', () => ({ PORTRAIT_IMAGE_MAX_BYTES: 8 * 1024 * 1024, prepareImageUpload: async value => value }))
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  native.getStatus.mockResolvedValue({ foldable: true, available: true, active: false, owner: '', photoUid: '' })
  native.hide.mockResolvedValue({ active: false, owner: '', photoUid: '' })
  vi.stubGlobal('FileReader', class { readAsDataURL() { this.result = 'data:image/webp;base64,AAAA'; queueMicrotask(() => this.onload()) } })
})
it('does not present a late image after its character was closed', async () => {
  const cover = await import('./coverDisplay')
  await cover.initializeCoverDisplay()
  cover.activateCoverOwner('character-a')
  let complete
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { complete = resolve })))
  const showing = cover.showCoverPhoto('character-a', { uid: 'photo-a', url: 'https://example.com/a.webp' })
  await cover.releaseCoverOwner('character-a')
  complete(new Response('image', { headers: { 'Content-Type': 'image/webp' } }))
  await showing
  expect(native.show).not.toHaveBeenCalled()
  expect(cover.coverState.busy).toBe(false)
  vi.unstubAllGlobals()
})
it('passes the character lease and image identity to the native presentation', async () => {
  const cover = await import('./coverDisplay')
  await cover.initializeCoverDisplay()
  cover.activateCoverOwner('character-b')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('image', { headers: { 'Content-Type': 'image/webp' } })))
  native.show.mockResolvedValue({ active: true, owner: 'character-b', photoUid: 'photo-b' })
  await cover.showCoverPhoto('character-b', { uid: 'photo-b', url: 'https://example.com/b.webp' })
  expect(native.show).toHaveBeenCalledWith({ owner: 'character-b', photoUid: 'photo-b', data: 'AAAA' })
  expect(cover.coverState.active).toBe(true)
  vi.unstubAllGlobals()
})

it('keeps the latest photo when earlier image loading finishes last', async () => {
  const cover = await import('./coverDisplay')
  await cover.initializeCoverDisplay()
  cover.activateCoverOwner('character')
  const responses = []
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => responses.push(resolve))))
  native.show.mockResolvedValue({ active: true, owner: 'character', photoUid: 'latest' })
  const first = cover.showCoverPhoto('character', { uid: 'first', url: 'https://example.com/first.webp' })
  const latest = cover.showCoverPhoto('character', { uid: 'latest', url: 'https://example.com/latest.webp' })
  responses[1](new Response('image', { headers: { 'Content-Type': 'image/webp' } }))
  await latest
  responses[0](new Response('image', { headers: { 'Content-Type': 'image/webp' } }))
  await first
  expect(native.show).toHaveBeenCalledOnce()
  expect(native.show.mock.calls[0][0].photoUid).toBe('latest')
  expect(cover.coverState.photoUid).toBe('latest')
  vi.unstubAllGlobals()
})
