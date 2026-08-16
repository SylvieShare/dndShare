<template>
  <div class="music-panel">
    <div class="music-panel-head">
      <span class="music-panel-title">МУЗЫКА</span>
      <button class="music-panel-library" @click="onOpenLibrary">библиотека ↗</button>
    </div>

    <div class="music-panel-body">
      <div class="music-panel-body-inner">
        <div class="now" :class="{ 'now--empty': !current }">
          <div class="now-row">
            <button class="now-play-btn" :disabled="!current" @click="togglePlay">
              <svg v-if="!state.playing" width="14" height="14" viewBox="0 0 14 14">
                <path d="M3.5 2.5v9l8-4.5-8-4.5z" fill="currentColor"/>
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 14 14">
                <rect x="3.5" y="2.5" width="2.6" height="9" fill="currentColor"/>
                <rect x="7.9" y="2.5" width="2.6" height="9" fill="currentColor"/>
              </svg>
            </button>

            <div class="now-text">
              <div v-if="current" class="now-status">
                <span class="now-status-dot" />
                <span class="now-status-label">{{ state.playing ? (remotePlayback ? 'НА ЭКРАНЕ' : 'ИГРАЕТ') : 'ПАУЗА' }}</span>
              </div>
              <div v-else class="now-status now-status--dim">
                <span class="now-status-label">НИЧЕГО НЕ ИГРАЕТ</span>
              </div>
              <div class="now-title" :title="current?.name || ''">
                {{ current?.name || '—' }}
              </div>
              <div v-if="current" class="now-time">
                {{ fmtTime(state.positionSec) }} / {{ fmtTime(state.durationSec) }}
              </div>
            </div>

            <button
              class="now-loop-btn"
              :class="{ active: state.loopMode === 'track' }"
              :title="state.loopMode === 'track' ? 'Повтор одного трека' : 'Повтор альбома'"
              @click="onToggleLoop"
            >
              <svg v-if="state.loopMode === 'track'" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 5h7l-1.5-1.5M13 11H6l1.5 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3 5v3a3 3 0 0 0 3 3M13 11V8a3 3 0 0 0-3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                <text x="8" y="9.5" text-anchor="middle" font-size="5" font-weight="700" fill="currentColor">1</text>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 5h7l-1.5-1.5M13 11H6l1.5 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3 5v3a3 3 0 0 0 3 3M13 11V8a3 3 0 0 0-3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div
            class="now-seek"
            :class="{ 'now-seek--clickable': !!current && isDm }"
            @click="onSeek"
          >
            <div class="now-seek-fill" :style="{ width: progressPct + '%' }" />
          </div>

          <div class="now-controls">
            <div class="now-ctl">
              <span class="now-ctl-label">громкость</span>
              <AppSlider :model-value="state.volume" :min="0" :max="1" :step="0.01" @update:model-value="musicStore.setVolume" />
              <span class="now-ctl-value">{{ Math.round(state.volume * 100) }}%</span>
            </div>
          </div>
        </div>

        <div v-if="next" class="next-card">
          <button class="next-play-btn" title="Включить сейчас" @click="onPlayNextNow">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M3 1.5v9l7-4.5-7-4.5z" fill="currentColor"/>
            </svg>
          </button>
          <div class="next-text">
            <div class="next-label">СЛЕДУЮЩИЙ</div>
            <div class="next-title" :title="next.name">{{ next.name }}</div>
          </div>
          <button class="next-clear" title="Убрать" @click="onClearNext">×</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { AppSlider } from '@sylvieshare/share-ui'
import { useMusicStore } from '@/stores/music'

const props = defineProps({
  isDm: { type: Boolean, default: false },
})
const emit = defineEmits(['open-library'])

const musicStore = useMusicStore()
const { state, currentTrack, nextTrack, remotePlayback } = storeToRefs(musicStore)

const current = currentTrack
const next = nextTrack
const progressPct = computed(() => {
  if (!state.value.durationSec) return 0
  return Math.min(100, (state.value.positionSec / state.value.durationSec) * 100)
})

function onSeek(e) {
  if (!props.isDm || !current.value || !state.value.durationSec) return
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  musicStore.seek(ratio * state.value.durationSec)
}

function togglePlay() {
  if (!props.isDm) return
  if (state.value.playing) musicStore.pause()
  else musicStore.resume()
}
function onPlayNextNow() {
  if (!props.isDm) return
  musicStore.playNextFromQueue({ immediate: false })
}
function onClearNext() {
  if (!props.isDm) return
  musicStore.clearNext()
}
function onToggleLoop() {
  if (!props.isDm) return
  musicStore.toggleLoopMode()
}
function onOpenLibrary() {
  emit('open-library')
}

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}
</script>

<style scoped>
.music-panel {
  display: flex;
  flex-direction: column;
  padding: 14px 12px;
}

.music-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: var(--text-muted);
  padding: 0 2px;
}
.music-panel-title { color: var(--text-muted); }
.music-panel-library {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--accent);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-transform: lowercase;
  letter-spacing: 0;
  padding: 2px 4px;
  border-radius: 4px;
}
.music-panel-library:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.music-panel-body {
  display: grid;
  grid-template-rows: 1fr;
  padding-top: 10px;
}
.music-panel-body-inner {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.now {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.now--empty { opacity: 0.7; }

.now-seek {
  height: 6px;
  border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  overflow: hidden;
}
.now-seek--clickable { cursor: pointer; }
.now-seek--clickable:hover { background: color-mix(in srgb, var(--text-on-accent) 12%, transparent); }
.now-seek-fill {
  height: 100%;
  background: var(--accent);
  border-radius: var(--r-pill);
  transition: width 0.2s linear;
}

.now-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.now-play-btn {
  width: 38px; height: 38px;
  flex-shrink: 0;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: var(--text-on-accent);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.now-play-btn:hover:not(:disabled) { background: var(--accent-hover); }
.now-play-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.now-text { min-width: 0; flex: 1; }
.now-status { display: flex; align-items: center; gap: 5px; font-size: 9px; letter-spacing: 0.1em; font-weight: 700; color: var(--accent); }
.now-status--dim { color: var(--text-muted); }
.now-status-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.now-status-label { line-height: 1; }
.now-title {
  font-size: 14px; font-weight: 600;
  color: var(--text-1);
  margin-top: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.now-time { font-size: 11px; color: var(--text-muted); margin-top: 2px; font-variant-numeric: tabular-nums; }

.now-controls {
  display: flex; flex-direction: column; gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.now-ctl { display: flex; align-items: center; gap: 10px; }
.now-ctl-label { font-size: 10px; color: var(--text-2); min-width: 64px; }
.now-ctl-value { font-size: 11px; color: var(--text-2); min-width: 32px; text-align: right; font-variant-numeric: tabular-nums; }

.now-loop-btn {
  width: 30px; height: 30px;
  flex-shrink: 0;
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  background: none;
  color: var(--text-2);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.now-loop-btn:hover { border-color: var(--accent); color: var(--accent); }
.now-loop-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--text-on-accent);
}

.next-card {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
  border: 1px dashed var(--border-strong);
  border-radius: 12px;
}
.next-play-btn {
  width: 26px; height: 26px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  background: none;
  color: var(--text-2);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.next-play-btn:hover { color: var(--accent); border-color: var(--accent); }
.next-text { min-width: 0; flex: 1; }
.next-label { font-size: 9px; letter-spacing: 0.1em; font-weight: 700; color: var(--text-muted); }
.next-title { font-size: 12px; color: var(--text-2); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.next-clear {
  background: none; border: none; color: var(--text-muted); font-size: 16px;
  cursor: pointer; padding: 2px 4px;
}
.next-clear:hover { color: var(--danger); }
</style>
