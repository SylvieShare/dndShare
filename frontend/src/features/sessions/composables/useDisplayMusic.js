import { ref } from 'vue'

const DRIFT_TOLERANCE_SEC = 2
const SIGNED_URL_REFRESH_MS = 50 * 60 * 1000

export function useDisplayMusic() {
  const blocked = ref(false)
  const audioA = typeof Audio !== 'undefined' ? new Audio() : null
  const audioB = typeof Audio !== 'undefined' ? new Audio() : null
  const preloader = typeof Audio !== 'undefined' ? new Audio() : null
  for (const audio of [audioA, audioB, preloader]) {
    if (audio) audio.preload = 'auto'
  }

  let activeEl = audioA
  let idleEl = audioB
  let currentTrackId = null
  let latest = null
  let latestReceivedAt = 0
  let crossfadeRaf = null
  let stopped = true
  const urlCache = new Map()

  function rememberURL(trackId, url) {
    if (!trackId || !url) return ''
    const key = String(trackId)
    const cached = urlCache.get(key)
    if (cached && Date.now() - cached.savedAt < SIGNED_URL_REFRESH_MS) return cached.url
    urlCache.set(key, { url, savedAt: Date.now() })
    return url
  }

  function cancelCrossfade() {
    if (crossfadeRaf != null) cancelAnimationFrame(crossfadeRaf)
    crossfadeRaf = null
  }

  function playbackAgeSec(music) {
    if (!music?.playing || !music.syncedAt || !music.serverTime) return 0
    const sinceResponse = music === latest ? Math.max(0, Date.now() - latestReceivedAt) : 0
    return Math.max(0, (music.serverTime - music.syncedAt + sinceResponse) / 1000)
  }

  function targetPosition(music) {
    return Math.max(0, Number(music?.positionSec || 0) + playbackAgeSec(music))
  }

  function setPosition(audio, position, loop = false) {
    if (!audio || !Number.isFinite(position)) return
    const apply = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0
      const bounded = duration > 0
        ? (loop ? position % duration : Math.min(position, Math.max(0, duration - 0.05)))
        : position
      audio.currentTime = bounded
    }
    try {
      apply()
    } catch {
      audio.addEventListener('loadedmetadata', () => {
        try { apply() } catch { /* media may still be unavailable */ }
      }, { once: true })
    }
  }

  async function play(audio) {
    if (!audio) return false
    try {
      await audio.play()
      blocked.value = false
      return true
    } catch {
      blocked.value = true
      return false
    }
  }

  function finishSwap(incoming, previous, music) {
    activeEl = incoming
    idleEl = previous
    currentTrackId = music.trackId
    activeEl.loop = music.loopMode === 'track'
  }

  function runCrossfade(previous, incoming, music, initialProgress = 0) {
    cancelCrossfade()
    const durationMs = Math.max(0, Number(music.crossfadeDurSec || 0) * 1000)
    const startedAt = performance.now() - initialProgress * durationMs
    const tick = () => {
      const progress = durationMs > 0 ? Math.min(1, (performance.now() - startedAt) / durationMs) : 1
      const volume = Math.max(0, Math.min(1, Number(latest?.volume ?? music.volume ?? 0.8)))
      previous.volume = volume * (1 - progress)
      incoming.volume = volume * progress
      if (progress < 1) {
        crossfadeRaf = requestAnimationFrame(tick)
        return
      }
      previous.pause()
      previous.currentTime = 0
      crossfadeRaf = null
      const nextTrackURL = rememberURL(latest?.nextTrackId, latest?.nextTrackUrl)
      if (preloader && nextTrackURL && preloader.src !== nextTrackURL) preloader.src = nextTrackURL
    }
    tick()
  }

  async function changeTrack(music) {
    const previous = activeEl
    const incoming = idleEl
    cancelCrossfade()
    incoming.pause()
    const trackURL = rememberURL(music.trackId, music.trackUrl)
    incoming.src = trackURL
    incoming.loop = music.loopMode === 'track'
    setPosition(incoming, targetPosition(music), music.loopMode === 'track')

    if (!music.playing) {
      previous?.pause()
      incoming.volume = music.volume
      finishSwap(incoming, previous, music)
      blocked.value = false
      return
    }

    incoming.volume = 0
    const started = await play(incoming)
    finishSwap(incoming, previous, music)
    if (!started) {
      previous?.pause()
      return
    }

    const duration = Math.max(0, Number(music.crossfadeDurSec || 0))
    const progress = duration > 0 ? Math.min(1, playbackAgeSec(music) / duration) : 1
    if (previous?.src && !previous.paused && progress < 1) {
      runCrossfade(previous, incoming, music, progress)
    } else {
      previous?.pause()
      incoming.volume = music.volume
    }
  }

  async function sync(music) {
    if (music !== latest) latestReceivedAt = Date.now()
    latest = music
    if (!audioA || !audioB || !music?.enabled || !music.trackId || !music.trackUrl) {
      stop()
      return
    }
    stopped = false
    const nextTrackURL = rememberURL(music.nextTrackId, music.nextTrackUrl)
    if (preloader && nextTrackURL && crossfadeRaf == null && preloader.src !== nextTrackURL) preloader.src = nextTrackURL

    if (String(currentTrackId) !== String(music.trackId) || !activeEl?.src) {
      await changeTrack(music)
      return
    }

    activeEl.loop = music.loopMode === 'track'
    if (crossfadeRaf == null) activeEl.volume = Math.max(0, Math.min(1, music.volume))
    const position = targetPosition(music)
    if (Math.abs(activeEl.currentTime - position) > DRIFT_TOLERANCE_SEC) {
      setPosition(activeEl, position, music.loopMode === 'track')
    }
    if (music.playing) await play(activeEl)
    else {
      activeEl.pause()
      blocked.value = false
    }
  }

  function stop() {
    if (stopped) return
    stopped = true
    cancelCrossfade()
    for (const audio of [audioA, audioB, preloader]) {
      if (!audio) continue
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    currentTrackId = null
    blocked.value = false
  }

  async function unlock() {
    if (!latest) return
    await sync(latest)
  }

  function dispose() {
    latest = null
    latestReceivedAt = 0
    urlCache.clear()
    stop()
  }

  return { blocked, sync, stop, unlock, dispose }
}
