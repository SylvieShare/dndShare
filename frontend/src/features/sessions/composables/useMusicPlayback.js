import { computed, reactive, ref } from 'vue'
import * as musicApi from '@/shared/api/musicApi'

const DEFAULT_VOLUME = 0.8
const DEFAULT_CROSSFADE_SEC = 2.5
const SAVE_DEBOUNCE_MS = 500

export function useMusicPlayback({ tracks, trackById, albumById }) {
  // ---- player engine (DM side) ----
  // Two HTMLAudio elements for crossfade. `active` is currently audible, `idle` is preloaded for next.
  const audioA = typeof Audio !== 'undefined' ? new Audio() : null
  const audioB = typeof Audio !== 'undefined' ? new Audio() : null
  if (audioA) audioA.preload = 'auto'
  if (audioB) audioB.preload = 'auto'
  let activeEl = audioA
  let idleEl = audioB
  let selectedEl = null
  let playbackRequest = 0
  const mediaTrackIds = new WeakMap()

  const state = reactive({
    playing: false,
    loading: false,
    playbackError: '',
    trackId: null,
    albumId: null,
    positionSec: 0,
    durationSec: 0,
    volume: DEFAULT_VOLUME,
    crossfadeDurSec: DEFAULT_CROSSFADE_SEC,
    nextTrackId: null,
    loopMode: 'album', // 'album' | 'track'
    crossfading: false,
  })

  const sessionUuid = ref(null)
  const isDm = ref(false)
  const remotePlayback = ref(false)
  let saveTimer = null
  let positionTimer = null
  let crossfadeRaf = null
  let persistedPlaying = false
  let urlCache = new Map() // trackId -> { url, expiresAt }

  function setContext({ uuid, dm }) {
    sessionUuid.value = uuid
    isDm.value = !!dm
    startPositionTimer()
  }

  async function getPlayableUrl(trackId) {
    const cached = urlCache.get(trackId)
    const now = Date.now()
    if (cached && cached.expiresAt > now + 30_000) return cached.url
    const res = sessionUuid.value && isDm.value
      ? await musicApi.getSessionTrackUrl(sessionUuid.value, trackId)
      : await musicApi.getTrackUrl(trackId)
    urlCache.set(trackId, { url: res.url, expiresAt: now + res.ttlSec * 1000 })
    return res.url
  }

  function outputVolume() {
    return remotePlayback.value ? 0 : state.volume
  }

  function setRemotePlayback(enabled) {
    remotePlayback.value = !!enabled
    if (!activeEl || !idleEl) return
    audioA.muted = remotePlayback.value
    audioB.muted = remotePlayback.value
    if (remotePlayback.value) {
      activeEl.volume = 0
      idleEl.volume = 0
      if (persistedPlaying && !state.playing && state.trackId) resume().catch(() => {})
    } else if (!state.crossfading) {
      activeEl.volume = state.volume
      idleEl.volume = 0
    }
  }

  function setVolume(v) {
    state.volume = Math.max(0, Math.min(1, v))
    if (!state.crossfading && activeEl) activeEl.volume = outputVolume()
    schedulePersist()
  }

  function setCrossfade(sec) {
    state.crossfadeDurSec = Math.max(0, Math.min(15, Number(sec) || 0))
    schedulePersist()
  }

  function settleCrossfade() {
    if (crossfadeRaf) cancelAnimationFrame(crossfadeRaf)
    crossfadeRaf = null
    if (selectedEl === idleEl) {
      activeEl.pause()
      ;[activeEl, idleEl] = [idleEl, activeEl]
    }
    idleEl?.pause()
    state.crossfading = false
  }

  function playbackFailed() {
    if (selectedEl) mediaTrackIds.delete(selectedEl)
    urlCache.delete(state.trackId)
    pause()
    state.playbackError = 'Не удалось загрузить или воспроизвести трек. Попробуйте ещё раз.'
  }

  async function playTrack(trackId, { albumId = null, immediate = false, positionSec = 0, resumeCurrent = false } = {}) {
    if (!isDm.value || !activeEl || !idleEl) return
    const request = ++playbackRequest
    settleCrossfade()
    const crossfade = !resumeCurrent && !immediate && state.crossfadeDurSec > 0 && !activeEl.paused
    selectedEl = null
    const track = trackById(trackId)
    state.trackId = trackId
    state.albumId = albumId
    state.durationSec = track?.durationSec || 0
    state.positionSec = positionSec
    state.playing = false
    state.loading = true
    state.playbackError = ''
    persistedPlaying = false

    try {
      const target = crossfade ? idleEl : activeEl
      if (!resumeCurrent || mediaTrackIds.get(target) !== trackId) {
        const url = await getPlayableUrl(trackId)
        if (request !== playbackRequest) return
        target.src = url
        mediaTrackIds.set(target, trackId)
      }
      selectedEl = target
      target.volume = crossfade ? 0 : outputVolume()
      try { target.currentTime = positionSec } catch {
        target.addEventListener('loadedmetadata', () => {
          if (request === playbackRequest) target.currentTime = positionSec
        }, { once: true })
      }
      await target.play()
      if (request !== playbackRequest) return
      state.loading = false
      state.playing = true
      persistedPlaying = true
      if (crossfade) runCrossfade()
      schedulePersist(true)
    } catch {
      if (request === playbackRequest) playbackFailed()
    }
  }

  function runCrossfade() {
    state.crossfading = true
    const dur = state.crossfadeDurSec * 1000
    const t0 = performance.now()
    const fromEl = activeEl
    const toEl = idleEl
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / dur)
      const targetVolume = outputVolume()
      if (fromEl) fromEl.volume = targetVolume * (1 - t)
      if (toEl) toEl.volume = targetVolume * t
      if (t < 1) {
        crossfadeRaf = requestAnimationFrame(tick)
      } else {
        try { fromEl?.pause(); fromEl.currentTime = 0 } catch { /* ignore */ }
        activeEl = toEl
        idleEl = fromEl
        state.crossfading = false
        state.playing = true
        crossfadeRaf = null
        schedulePersist(true)
      }
    }
    tick()
  }

  function pause() {
    if (!activeEl) return
    playbackRequest += 1
    settleCrossfade()
    selectedEl = null
    activeEl.pause()
    state.loading = false
    state.playing = false
    persistedPlaying = false
    schedulePersist(true)
  }

  async function resume() {
    if (!state.trackId || state.loading) return
    return playTrack(state.trackId, {
      albumId: state.albumId, immediate: true, positionSec: state.positionSec, resumeCurrent: true,
    })
  }

  function seek(sec) {
    const target = selectedEl || activeEl
    if (!target || state.loading) return
    target.currentTime = Math.max(0, Math.min(state.durationSec || sec, sec))
    state.positionSec = target.currentTime
    schedulePersist(true)
  }

  function setNext(trackId) {
    if (trackId === state.trackId) return
    state.nextTrackId = trackId
    schedulePersist()
  }
  function clearNext() {
    state.nextTrackId = null
    schedulePersist()
  }
  function toggleLoopMode() {
    state.loopMode = state.loopMode === 'track' ? 'album' : 'track'
    schedulePersist()
  }
  async function playNextFromQueue({ immediate = false } = {}) {
    if (!state.nextTrackId) return
    const nextId = state.nextTrackId
    state.nextTrackId = null
    await playTrack(nextId, { albumId: state.albumId, immediate })
  }

  function nextAlbumTrackId() {
    if (!state.albumId || !state.trackId) return null
    const album = albumById(state.albumId)
    if (!album) return null
    const albumTracks = tracks.value.filter(t => (t.albumIds || []).includes(album.id))
    if (!albumTracks.length) return null
    const idx = albumTracks.findIndex(t => t.id === state.trackId)
    if (idx === -1) return albumTracks[0].id
    return albumTracks[(idx + 1) % albumTracks.length].id
  }

  const playbackNextTrack = computed(() => {
    const nextId = state.nextTrackId || nextAlbumTrackId()
    if (!nextId || nextId === state.trackId) return null
    return trackById(nextId)
  })

  async function playNext({ immediate = false } = {}) {
    const nextId = playbackNextTrack.value?.id
    if (!nextId) return
    if (state.nextTrackId === nextId) state.nextTrackId = null
    await playTrack(nextId, { albumId: state.albumId, immediate })
  }

  function attachEndedHandler() {
    if (!audioA || !audioB) return
    const onEnded = event => {
      if (event.target !== selectedEl || !state.playing) return
      state.loading = false
      if (state.nextTrackId) {
        playNextFromQueue({ immediate: true })
      } else if (state.loopMode === 'track' && state.trackId) {
        playTrack(state.trackId, { albumId: state.albumId, immediate: true })
      } else if (state.loopMode === 'album') {
        const nextId = nextAlbumTrackId()
        if (nextId) playTrack(nextId, { albumId: state.albumId, immediate: true })
        else { state.playing = false; persistedPlaying = false; schedulePersist(true) }
      } else {
        state.playing = false
        persistedPlaying = false
        schedulePersist(true)
      }
    }
    audioA.addEventListener('ended', onEnded)
    audioB.addEventListener('ended', onEnded)
    for (const audio of [audioA, audioB]) {
      const onWaiting = () => {
        if (audio === selectedEl && !audio.paused && audio.readyState < 3) state.loading = true
      }
      audio.addEventListener('waiting', onWaiting)
      audio.addEventListener('stalled', onWaiting)
      audio.addEventListener('playing', () => {
        if (audio === selectedEl) state.loading = false
      })
      audio.addEventListener('error', () => {
        if (audio === selectedEl) playbackFailed()
      })
    }
  }
  attachEndedHandler()

  function startPositionTimer() {
    stopPositionTimer()
    positionTimer = setInterval(() => {
      const timelineEl = state.crossfading ? idleEl : activeEl
      if (timelineEl && state.playing) state.positionSec = timelineEl.currentTime
    }, 500)
  }
  function stopPositionTimer() {
    if (positionTimer) { clearInterval(positionTimer); positionTimer = null }
  }
  startPositionTimer()

  function schedulePersist(immediate = false) {
    if (!isDm.value || !sessionUuid.value) return
    if (saveTimer) clearTimeout(saveTimer)
    const delay = immediate ? 0 : SAVE_DEBOUNCE_MS
    saveTimer = setTimeout(persist, delay)
  }

  async function persist() {
    if (!isDm.value || !sessionUuid.value) return
    // Keep the outgoing track on the display until the incoming audio is ready.
    if (state.loading && !state.playing) return
    const snapshot = {
      playing: state.playing,
      trackId: state.trackId,
      albumId: state.albumId,
      positionSec: state.positionSec,
      volume: state.volume,
      crossfadeDurSec: state.crossfadeDurSec,
      nextTrackId: state.nextTrackId,
      loopMode: state.loopMode,
    }
    try { await musicApi.saveSessionMusic(sessionUuid.value, snapshot) } catch { /* ignore */ }
  }

  async function loadSessionState() {
    if (!sessionUuid.value) return
    try {
      const data = await musicApi.getSessionMusic(sessionUuid.value)
      if (data && typeof data === 'object') {
        state.trackId = data.trackId ?? null
        state.albumId = data.albumId ?? null
        const elapsedSec = data.playing && data.syncedAt && data.serverTime
          ? Math.max(0, (data.serverTime - data.syncedAt) / 1000)
          : 0
        state.positionSec = Math.max(0, (data.positionSec ?? 0) + elapsedSec)
        state.volume = data.volume ?? DEFAULT_VOLUME
        state.crossfadeDurSec = data.crossfadeDurSec ?? DEFAULT_CROSSFADE_SEC
        state.nextTrackId = data.nextTrackId ?? null
        state.loopMode = data.loopMode === 'track' ? 'track' : 'album'
        persistedPlaying = !!data.playing
        state.playing = false
        const t = state.trackId ? trackById(state.trackId) : null
        state.durationSec = t?.durationSec || 0
        if (state.durationSec > 0) {
          state.positionSec = state.loopMode === 'track'
            ? state.positionSec % state.durationSec
            : Math.min(state.positionSec, Math.max(0, state.durationSec - 0.05))
        }
        if (remotePlayback.value && persistedPlaying && state.trackId) resume().catch(() => {})
      }
    } catch { /* ignore */ }
  }

  function dispose() {
    pause()
    stopPositionTimer()
    if (crossfadeRaf) cancelAnimationFrame(crossfadeRaf)
    if (saveTimer) clearTimeout(saveTimer)
    try { audioA?.pause(); audioB?.pause() } catch { /* ignore */ }
    state.playing = false
    persistedPlaying = false
    remotePlayback.value = false
  }

  const currentTrack = computed(() => state.trackId ? trackById(state.trackId) : null)
  const nextTrack = computed(() => state.nextTrackId ? trackById(state.nextTrackId) : null)

  return {
    // player state
    state, currentTrack, nextTrack, playbackNextTrack, remotePlayback,
    setContext, loadSessionState,
    playTrack, pause, resume, seek,
    setVolume, setCrossfade, setRemotePlayback,
    setNext, clearNext, playNext, playNextFromQueue, toggleLoopMode,
    dispose,
  }
}
