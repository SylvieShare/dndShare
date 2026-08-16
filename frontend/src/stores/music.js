import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import * as musicApi from '@/shared/api/musicApi'

const DEFAULT_VOLUME = 0.8
const DEFAULT_CROSSFADE_SEC = 2.5
const SAVE_DEBOUNCE_MS = 500

export const useMusicStore = defineStore('music', () => {
  // ---- library ----
  const tracks = ref([])
  const albums = ref([])
  const tags = ref([])
  const libraryLoaded = ref(false)
  const libraryLoading = ref(false)

  async function ensureLibrary(force = false) {
    if (libraryLoaded.value && !force) return
    if (libraryLoading.value) return
    libraryLoading.value = true
    try {
      const [t, a, g] = await Promise.all([musicApi.getTracks(), musicApi.getAlbums(), musicApi.getTags()])
      tracks.value = t?.tracks ?? []
      albums.value = a?.albums ?? []
      tags.value = g?.tags ?? []
      libraryLoaded.value = true
    } finally {
      libraryLoading.value = false
    }
  }

  function trackById(id) {
    return tracks.value.find(t => t.id === id) || null
  }
  function albumById(id) {
    return albums.value.find(a => a.id === id) || null
  }

  async function uploadTrack(args) {
    const t = await musicApi.uploadTrack(args)
    tracks.value = [t, ...tracks.value.filter(x => x.id !== t.id)]
    if (args.albumId) await refreshAlbums()
    return t
  }
  async function renameTrack(id, name) {
    const t = await musicApi.renameTrack(id, name)
    tracks.value = tracks.value.map(x => x.id === id ? t : x)
  }
  async function deleteTrack(id) {
    await musicApi.deleteTrack(id)
    tracks.value = tracks.value.filter(x => x.id !== id)
    await refreshAlbums()
  }
  async function createAlbum(data) {
    const a = await musicApi.createAlbum(data)
    albums.value = [...albums.value, a]
    return a
  }
  async function updateAlbum(id, data) {
    const a = await musicApi.updateAlbum(id, data)
    albums.value = albums.value.map(x => x.id === id ? a : x)
  }
  async function deleteAlbum(id) {
    await musicApi.deleteAlbum(id)
    albums.value = albums.value.filter(x => x.id !== id)
    tracks.value = tracks.value.map(t => ({ ...t, albumIds: (t.albumIds || []).filter(aid => aid !== id) }))
  }
  async function addTrackToAlbum(albumId, trackId) {
    await musicApi.addTrackToAlbum(albumId, trackId)
    const t = trackById(trackId)
    if (t && !(t.albumIds || []).includes(albumId)) {
      tracks.value = tracks.value.map(x => x.id === trackId ? { ...x, albumIds: [...(x.albumIds || []), albumId] } : x)
    }
    await refreshAlbums()
    await loadAlbumTracks(albumId)
  }
  async function removeTrackFromAlbum(albumId, trackId) {
    await musicApi.removeTrackFromAlbum(albumId, trackId)
    tracks.value = tracks.value.map(x => x.id === trackId ? { ...x, albumIds: (x.albumIds || []).filter(a => a !== albumId) } : x)
    albumOrder.value = { ...albumOrder.value, [albumId]: (albumOrder.value[albumId] || []).filter(id => id !== trackId) }
    await refreshAlbums()
  }
  // albumId -> ordered list of track ids
  const albumOrder = ref({})
  async function loadAlbumTracks(albumId) {
    const res = await musicApi.getAlbumTracks(albumId)
    const list = res?.tracks ?? []
    albumOrder.value = { ...albumOrder.value, [albumId]: list.map(t => t.id) }
  }
  async function reorderAlbum(albumId, trackIds) {
    albumOrder.value = { ...albumOrder.value, [albumId]: trackIds.slice() }
    await musicApi.setAlbumOrder(albumId, trackIds)
  }
  async function addTrackTag(trackId, name) {
    const t = await musicApi.addTrackTag(trackId, name)
    tracks.value = tracks.value.map(x => x.id === trackId ? t : x)
    if (!tags.value.find(g => g.name.toLowerCase() === name.trim().toLowerCase())) {
      const refreshed = await musicApi.getTags()
      tags.value = refreshed?.tags ?? tags.value
    }
  }
  async function attachTrackTag(trackId, tagId) {
    const t = await musicApi.attachTrackTag(trackId, tagId)
    tracks.value = tracks.value.map(x => x.id === trackId ? t : x)
  }
  async function removeTrackTag(trackId, tagId) {
    await musicApi.removeTrackTag(trackId, tagId)
    tracks.value = tracks.value.map(x => x.id === trackId
      ? { ...x, tags: (x.tags || []).filter(t => t.id !== tagId) }
      : x)
  }
  async function createTag(name) {
    const tag = await musicApi.createTag(name)
    if (!tags.value.find(g => g.id === tag.id)) tags.value = [...tags.value, tag]
    return tag
  }
  async function renameTag(id, name) {
    const tag = await musicApi.renameTag(id, name)
    tags.value = tags.value.map(g => g.id === id ? tag : g)
    tracks.value = tracks.value.map(t => ({
      ...t,
      tags: (t.tags || []).map(g => g.id === id ? tag : g),
    }))
  }
  async function deleteTag(id) {
    await musicApi.deleteTag(id)
    tags.value = tags.value.filter(g => g.id !== id)
    tracks.value = tracks.value.map(t => ({
      ...t,
      tags: (t.tags || []).filter(g => g.id !== id),
    }))
  }
  async function refreshAlbums() {
    const a = await musicApi.getAlbums()
    albums.value = a?.albums ?? []
  }

  // ---- player engine (DM side) ----
  // Two HTMLAudio elements for crossfade. `active` is currently audible, `idle` is preloaded for next.
  const audioA = typeof Audio !== 'undefined' ? new Audio() : null
  const audioB = typeof Audio !== 'undefined' ? new Audio() : null
  if (audioA) audioA.preload = 'auto'
  if (audioB) audioB.preload = 'auto'
  let activeEl = audioA
  let idleEl = audioB

  const state = reactive({
    playing: false,
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

  async function playTrack(trackId, { albumId = null, immediate = false } = {}) {
    if (!isDm.value || !activeEl || !idleEl) return
    const url = await getPlayableUrl(trackId)
    const track = trackById(trackId)
    state.trackId = trackId
    state.albumId = albumId
    state.durationSec = track?.durationSec || 0
    state.positionSec = 0

    if (immediate || state.crossfadeDurSec <= 0 || activeEl.paused) {
      activeEl.src = url
      activeEl.volume = outputVolume()
      await activeEl.play().catch(() => {})
      state.playing = true
      persistedPlaying = true
      schedulePersist(true)
      return
    }
    // crossfade: swap roles, ramp gains
    idleEl.src = url
    idleEl.volume = 0
    await idleEl.play().catch(() => {})
    runCrossfade()
    state.playing = true
    persistedPlaying = true
    schedulePersist(true)
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
    activeEl.pause()
    state.playing = false
    persistedPlaying = false
    schedulePersist(true)
  }

  async function resume() {
    if (!activeEl) return
    if (!state.trackId) return
    if (!activeEl.src) {
      const url = await getPlayableUrl(state.trackId)
      activeEl.src = url
      try {
        activeEl.currentTime = state.positionSec || 0
      } catch {
        activeEl.addEventListener('loadedmetadata', () => {
          try { activeEl.currentTime = state.positionSec || 0 } catch { /* unavailable media */ }
        }, { once: true })
      }
    }
    activeEl.volume = outputVolume()
    await activeEl.play().catch(() => {})
    state.playing = true
    persistedPlaying = true
    schedulePersist(true)
  }

  function seek(sec) {
    if (!activeEl) return
    activeEl.currentTime = Math.max(0, Math.min(state.durationSec || sec, sec))
    state.positionSec = activeEl.currentTime
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

  function attachEndedHandler() {
    if (!audioA || !audioB) return
    const onEnded = () => {
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
    // library state
    tracks, albums, tags, libraryLoaded, libraryLoading, albumOrder,
    ensureLibrary, trackById, albumById,
    uploadTrack, renameTrack, deleteTrack,
    createAlbum, updateAlbum, deleteAlbum,
    addTrackToAlbum, removeTrackFromAlbum,
    loadAlbumTracks, reorderAlbum,
    addTrackTag, attachTrackTag, removeTrackTag,
    createTag, renameTag, deleteTag,
    // player state
    state, currentTrack, nextTrack, remotePlayback,
    setContext, loadSessionState,
    playTrack, pause, resume, seek,
    setVolume, setCrossfade, setRemotePlayback,
    setNext, clearNext, playNextFromQueue, toggleLoopMode,
    dispose,
  }
})
