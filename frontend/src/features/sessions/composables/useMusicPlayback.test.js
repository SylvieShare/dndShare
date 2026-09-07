import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMusicStore } from '@/stores/music'
import * as api from '@/shared/api/musicApi'

vi.mock('@/shared/api/musicApi', () => ({
  getSessionTrackUrl: vi.fn(), getTrackUrl: vi.fn(), saveSessionMusic: vi.fn(),
}))

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }
let audios, store

beforeEach(() => {
  vi.useFakeTimers()
  audios = []
  vi.stubGlobal('Audio', class extends EventTarget {
    paused = true
    currentTime = 0
    readyState = 0
    src = ''
    play = vi.fn(() => { this.paused = false; return Promise.resolve() })
    pause = vi.fn(() => { this.paused = true })
    constructor() { super(); audios.push(this) }
  })
  vi.stubGlobal('requestAnimationFrame', callback => setTimeout(() => callback(performance.now()), 16))
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
  vi.mocked(api.getSessionTrackUrl).mockImplementation(async (_, id) => ({ url: `track-${id}`, ttlSec: 3600 }))
  setActivePinia(createPinia())
  store = useMusicStore()
  store.tracks = [{ id: 1, name: 'Первый', durationSec: 120 }, { id: 2, name: 'Второй', durationSec: 180 }]
  store.setContext({ uuid: 'session', dm: true })
})

afterEach(() => {
  store.dispose()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('music playback loading', () => {
  it('shows the selected track as loading during URL retrieval and audio download', async () => {
    const url = deferred(), media = deferred()
    vi.mocked(api.getSessionTrackUrl).mockReturnValueOnce(url.promise)
    audios[0].play.mockImplementationOnce(() => { audios[0].paused = false; return media.promise })
    const playing = store.playTrack(1)
    expect(store.currentTrack.name).toBe('Первый')
    expect(store.state).toMatchObject({ trackId: 1, loading: true, playing: false })
    url.resolve({ url: 'slow-track', ttlSec: 3600 })
    await flush()
    expect(store.state.loading).toBe(true)
    media.resolve()
    await playing
    expect(store.state).toMatchObject({ loading: false, playing: true, playbackError: '' })
  })

  it('tracks buffering only on the selected audio and clears it when sound resumes', async () => {
    await store.playTrack(1)
    audios[1].paused = false
    audios[1].dispatchEvent(new Event('waiting'))
    expect(store.state.loading).toBe(false)
    audios[0].readyState = 2
    audios[0].dispatchEvent(new Event('waiting'))
    expect(store.state.loading).toBe(true)
    audios[0].dispatchEvent(new Event('playing'))
    expect(store.state.loading).toBe(false)
    audios[0].readyState = 4
    audios[0].dispatchEvent(new Event('stalled'))
    expect(store.state.loading).toBe(false)
  })

  it('keeps the most recently selected track when signed URLs finish out of order', async () => {
    const slow = deferred()
    vi.mocked(api.getSessionTrackUrl).mockReturnValueOnce(slow.promise)
    const first = store.playTrack(1)
    await store.playTrack(2)
    slow.resolve({ url: 'obsolete-track', ttlSec: 3600 })
    await first
    expect(audios[0].src).toBe('track-2')
    expect(store.state).toMatchObject({ trackId: 2, loading: false, playing: true })
  })

  it('does not resume after cancelling an in-flight download', async () => {
    const pending = deferred()
    audios[0].play.mockReturnValueOnce(pending.promise)
    const playing = store.playTrack(1)
    await flush()
    store.pause()
    pending.resolve()
    await playing
    expect(store.state).toMatchObject({ loading: false, playing: false })
    expect(audios[0].pause).toHaveBeenCalled()
  })

  it('shows errors instead of claiming that a rejected play succeeded, and allows retry', async () => {
    audios[0].play.mockRejectedValueOnce(new Error('media unavailable'))
    await store.playTrack(1)
    expect(store.state).toMatchObject({ loading: false, playing: false })
    expect(store.state.playbackError).not.toBe('')
    await store.resume()
    expect(api.getSessionTrackUrl).toHaveBeenCalledTimes(2)
    expect(store.state).toMatchObject({ loading: false, playing: true, playbackError: '' })
    audios[0].dispatchEvent(new Event('error'))
    expect(store.state).toMatchObject({ loading: false, playing: false })
  })

  it('clears loading on a signed URL error and on disposal', async () => {
    vi.mocked(api.getSessionTrackUrl).mockRejectedValueOnce(new Error('offline'))
    await store.playTrack(1)
    expect(store.state.loading).toBe(false)
    expect(store.state.playbackError).not.toBe('')
    const pending = deferred()
    vi.mocked(api.getSessionTrackUrl).mockReturnValueOnce(pending.promise)
    const playing = store.playTrack(2)
    store.dispose()
    pending.resolve({ url: 'disposed-track', ttlSec: 3600 })
    await playing
    expect(store.state).toMatchObject({ loading: false, playing: false })
  })

  it('loads the incoming crossfade track before fading and ignores outgoing media events', async () => {
    await store.playTrack(1)
    const incoming = deferred()
    audios[1].play.mockImplementationOnce(() => { audios[1].paused = false; return incoming.promise })
    const playing = store.playTrack(2)
    await flush()
    expect(store.state).toMatchObject({ loading: true, crossfading: false })
    audios[0].dispatchEvent(new Event('playing'))
    expect(store.state.loading).toBe(true)
    incoming.resolve()
    await playing
    expect(store.state).toMatchObject({ loading: false, crossfading: true })
    audios[0].dispatchEvent(new Event('ended'))
    expect(store.state.playing).toBe(true)
    store.pause()
    expect(store.state.crossfading).toBe(false)
    expect(audios.every(audio => audio.paused)).toBe(true)
  })
})
