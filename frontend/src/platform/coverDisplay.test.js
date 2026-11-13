import { beforeEach, expect, it, vi } from 'vitest'
const native = vi.hoisted(() => ({ addListener: vi.fn(), getStatus: vi.fn(), show: vi.fn(), hide: vi.fn(), cancelPhoto: vi.fn(), startSlideshow: vi.fn(), pauseSlideshow: vi.fn(), updateSlideshow: vi.fn() }))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => native }))
vi.mock('./storage', () => ({ isAndroid: true }))
vi.mock('../shared/lib/imageUpload', () => ({ PORTRAIT_IMAGE_MAX_BYTES: 8 * 1024 * 1024, prepareImageUpload: async value => value }))
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  native.getStatus.mockResolvedValue({ foldable: true, available: true, active: false, selected: false, owner: '', photoUid: '' })
  native.hide.mockResolvedValue({ active: false, selected: false, owner: '', photoUid: '' })
  vi.stubGlobal('FileReader', class { readAsDataURL() { this.result = 'data:image/webp;base64,AAAA'; queueMicrotask(() => this.onload()) } })
})
it('does not present a late image after the user explicitly cancels it', async () => {
  const cover = await import('./coverDisplay')
  await cover.initializeCoverDisplay()
  let complete
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { complete = resolve })))
  const showing = cover.showCoverPhoto('character-a', { uid: 'photo-a', url: 'https://example.com/a.webp' })
  await cover.stopCover('character-a')
  complete(new Response('image', { headers: { 'Content-Type': 'image/webp' } }))
  await showing
  expect(native.show).not.toHaveBeenCalled()
  expect(cover.coverState.busy).toBe(false)
  vi.unstubAllGlobals()
})
it('passes the photo origin and image identity to the native presentation', async () => {
  const cover = await import('./coverDisplay')
  await cover.initializeCoverDisplay()
  vi.stubGlobal('fetch', vi.fn(async () => new Response('image', { headers: { 'Content-Type': 'image/webp' } })))
  native.show.mockResolvedValue({ active: true, owner: 'character-b', photoUid: 'photo-b' })
  await cover.showCoverPhoto('character-b', { uid: 'photo-b', url: 'https://example.com/b.webp' })
  expect(native.show).toHaveBeenCalledWith({ owner: 'character-b', photoUid: 'photo-b', data: 'AAAA' })
  expect(cover.coverState.active).toBe(true)
  vi.unstubAllGlobals()
})

it('adopts a selected native photo after the web interface reloads without cancelling it', async () => {
  native.getStatus.mockResolvedValue({ foldable: true, available: true, active: true, selected: true, owner: 'character', photoUid: 'photo' })
  const cover = await import('./coverDisplay')
  await cover.initializeCoverDisplay()
  expect(cover.coverState.selected).toBe(true)
  expect(cover.coverState.photoUid).toBe('photo')
  expect(native.hide).not.toHaveBeenCalled()
})

it('keeps the latest photo when earlier image loading finishes last', async () => {
  const cover = await import('./coverDisplay')
  await cover.initializeCoverDisplay()
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

it('starts a native playlist and pauses rotation without hiding the current image', async () => {
  const cover = await import('./coverDisplay')
  await cover.initializeCoverDisplay()
  native.startSlideshow.mockResolvedValue({ autoplay: true, autoOwner: 'character', active: true, owner: 'character', photoUid: 'a' })
  const photo = { uid: 'a', url: 'https://example.com/a.webp', thumbnailUrl: 'https://example.com/thumb.webp', imageId: 1, name: 'Photo' }
  await cover.startCoverSlideshow('character', [photo])
  expect(native.startSlideshow).toHaveBeenCalledWith({ owner: 'character', photos: [{ uid: 'a', url: photo.url, thumbnailUrl: photo.thumbnailUrl, imageId: 1 }] })
  native.pauseSlideshow.mockResolvedValue({ autoplay: false, active: true, owner: 'character', photoUid: 'a' })
  await cover.pauseCoverSlideshow('character')
  expect(cover.coverState.autoplay).toBe(false)
  expect(cover.coverState.active).toBe(true)
  expect(native.hide).not.toHaveBeenCalled()
})

it('updates an automatic gallery instead of cancelling the show when a displayed photo is deleted', async () => {
  const cover = await import('./coverDisplay')
  await cover.initializeCoverDisplay()
  Object.assign(cover.coverState, { autoplay: true, autoOwner: 'character', owner: 'character', photoUid: 'a' })
  native.updateSlideshow.mockResolvedValue({ autoplay: true, photoUid: 'b' })
  await cover.updateCoverGallery('character', [{ uid: 'b', url: '/b.webp', imageId: 2 }])
  expect(native.updateSlideshow).toHaveBeenCalledWith({ owner: 'character', photos: [{ uid: 'b', url: '/b.webp', thumbnailUrl: '', imageId: 2 }] })
  expect(native.hide).not.toHaveBeenCalled()
  await cover.updateCoverGallery('another-character', [])
  expect(native.updateSlideshow).toHaveBeenCalledOnce()
})

it('ignores a delayed start response after autoplay is cancelled', async () => {
  const cover = await import('./coverDisplay')
  await cover.initializeCoverDisplay()
  let finish
  native.startSlideshow.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const starting = cover.startCoverSlideshow('character', [{ uid: 'a', url: '/a.webp' }])
  await cover.stopCover('character')
  finish({ autoplay: true, active: true, owner: 'character', photoUid: 'a' })
  await starting
  expect(cover.coverState.active).toBe(false)
  expect(cover.coverState.busy).toBe(false)
})

it.each([false, true])('cancels a removed pending manual photo while preserving an existing display (autoplay: %s)', async autoplay => {
  const cover = await import('./coverDisplay')
  await cover.initializeCoverDisplay()
  const status = { active: true, selected: true, owner: 'character', photoUid: 'current', autoplay, autoOwner: autoplay ? 'character' : '' }
  Object.assign(cover.coverState, status)
  native.cancelPhoto.mockResolvedValue(status)
  native.updateSlideshow.mockResolvedValue(status)
  let finish
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve })))
  const showing = cover.showCoverPhoto('character', { uid: 'removed', url: '/removed.webp' })
  await cover.updateCoverGallery('character', [{ uid: 'current', url: '/current.webp' }])
  finish(new Response('image', { headers: { 'Content-Type': 'image/webp' } }))
  await showing
  expect(native.cancelPhoto).toHaveBeenCalledWith({ owner: 'character', photoUid: 'removed' })
  expect(native.show).not.toHaveBeenCalled()
  expect(native.hide).not.toHaveBeenCalled()
  expect(cover.coverState.active).toBe(true)
  expect(cover.coverState.autoplay).toBe(autoplay)
  vi.unstubAllGlobals()
})
