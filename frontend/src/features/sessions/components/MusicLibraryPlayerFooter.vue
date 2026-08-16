<template>
  <footer v-if="current" class="music-lib-foot">
    <div class="foot-current">
      <button class="foot-play-btn" @click="onPlayPause">
        <svg v-if="!state.playing" width="14" height="14" viewBox="0 0 14 14">
          <path d="M3.5 2.5v9l8-4.5-8-4.5z" fill="currentColor"/>
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 14 14">
          <rect x="3.5" y="2.5" width="2.6" height="9" fill="currentColor"/>
          <rect x="7.9" y="2.5" width="2.6" height="9" fill="currentColor"/>
        </svg>
      </button>
      <button
        class="foot-loop-btn"
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
      <div class="foot-text">
        <div class="foot-status"><span class="foot-status-dot" />{{ state.playing ? 'ИГРАЕТ' : 'ПАУЗА' }}</div>
        <div class="foot-title" :title="current.name">{{ current.name }}</div>
        <div class="foot-progress" :class="{ 'foot-progress--clickable': isDm }" @click="onSeek">
          <div class="foot-progress-bar" :style="{ width: progressPct + '%' }" />
        </div>
        <div class="foot-time">{{ fmtTime(state.positionSec) }} / {{ fmtTime(state.durationSec) }}</div>
      </div>
    </div>

    <div class="foot-cross">
      <button class="foot-cross-btn" :disabled="!next" @click="onPlayNext">
        <svg width="13" height="13" viewBox="0 0 14 14">
          <path d="M2 2l5 5-5 5M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Переключить сейчас
      </button>
      <div class="foot-cross-fade">
        <span class="foot-cross-fade-label">фейд</span>
        <AppSlider :model-value="state.crossfadeDurSec" :min="0" :max="15" :step="0.5" @update:model-value="musicStore.setCrossfade" />
        <span class="foot-cross-fade-value">{{ state.crossfadeDurSec.toFixed(1) }}с</span>
      </div>
      <div class="foot-cross-fade">
        <span class="foot-cross-fade-label">громкость</span>
        <AppSlider :model-value="state.volume" :min="0" :max="1" :step="0.01" @update:model-value="musicStore.setVolume" />
        <span class="foot-cross-fade-value">{{ Math.round(state.volume * 100) }}%</span>
      </div>
    </div>

    <div class="foot-next">
      <div class="foot-next-head">
        <span class="foot-next-label">СЛЕДУЮЩИЙ</span>
        <button v-if="next" class="foot-next-clear" title="Убрать" @click="onClearNext">× убрать</button>
      </div>
      <div v-if="next" class="foot-next-title" :title="next.name">{{ next.name }}</div>
      <div v-else class="foot-next-empty">не выбран</div>
      <div v-if="next" class="foot-next-meta">
        {{ fmtTime(next.durationSec) }}<template v-if="nextAlbum"> · из «{{ nextAlbum.name }}»</template>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { AppSlider } from '@sylvieshare/share-ui'
import { fmtTime } from '@/features/sessions/lib/musicLibrary'
import { useMusicStore } from '@/stores/music'

const props = defineProps({ isDm: { type: Boolean, default: false } })
const musicStore = useMusicStore()
const { state, currentTrack: current, nextTrack: next } = storeToRefs(musicStore)
const nextAlbum = computed(() => state.value.albumId ? musicStore.albumById(state.value.albumId) : null)
const progressPct = computed(() => state.value.durationSec
  ? Math.min(100, (state.value.positionSec / state.value.durationSec) * 100)
  : 0)

function onPlayPause() {
  if (!props.isDm || !current.value) return
  if (state.value.playing) musicStore.pause()
  else musicStore.resume()
}

function onSeek(event) {
  if (!props.isDm || !current.value || !state.value.durationSec) return
  const rect = event.currentTarget.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  musicStore.seek(ratio * state.value.durationSec)
}

function onPlayNext() {
  if (props.isDm) musicStore.playNextFromQueue()
}

function onClearNext() {
  if (props.isDm) musicStore.clearNext()
}

function onToggleLoop() {
  if (props.isDm) musicStore.toggleLoopMode()
}
</script>

<style scoped>
.music-lib-foot { display: grid; grid-template-columns: 1fr auto 1fr; gap: 24px; align-items: center; flex-shrink: 0; padding: 12px 24px; border-top: 1px solid var(--border); background: color-mix(in srgb, var(--surface-raised) 48%, transparent); }
.foot-current { display: flex; align-items: center; gap: 14px; min-width: 0; }
.foot-play-btn { width: 38px; height: 38px; display: flex; flex-shrink: 0; align-items: center; justify-content: center; border: 0; border-radius: 50%; background: var(--accent); color: var(--text-on-accent); cursor: pointer; }
.foot-loop-btn { width: 32px; height: 32px; display: flex; flex-shrink: 0; align-items: center; justify-content: center; border: 1px solid var(--surface-active); border-radius: 8px; background: none; color: var(--text-2); cursor: pointer; transition: border-color 0.15s, color 0.15s, background 0.15s; }
.foot-loop-btn:hover { border-color: var(--accent); color: var(--accent); }
.foot-loop-btn.active { border-color: var(--accent); background: var(--accent); color: var(--text-on-accent); }
.foot-text { min-width: 0; flex: 1; }
.foot-status { display: flex; align-items: center; gap: 5px; color: var(--accent); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; }
.foot-status-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.foot-title { overflow: hidden; margin-top: 2px; color: var(--text-1); font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.foot-progress { height: 4px; overflow: hidden; margin-top: 6px; border-radius: 2px; background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
.foot-progress--clickable { cursor: pointer; }
.foot-progress--clickable:hover { background: color-mix(in srgb, var(--text-on-accent) 10%, transparent); }
.foot-progress-bar { height: 100%; background: var(--accent); transition: width 0.2s linear; }
.foot-time { margin-top: 3px; color: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.foot-cross { min-width: 320px; display: flex; flex-direction: column; align-items: stretch; gap: 8px; padding: 0 16px; }
.foot-cross-btn { display: inline-flex; align-self: center; align-items: center; justify-content: center; gap: 7px; padding: 9px 18px; border: 0; border-radius: 9px; background: var(--accent); color: var(--text-on-accent); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.foot-cross-btn:disabled { cursor: not-allowed; opacity: 0.4; }
.foot-cross-fade { width: 100%; display: flex; align-items: center; gap: 10px; color: var(--text-2); font-size: 10px; letter-spacing: 0.04em; }
.foot-cross-fade-label, .foot-cross-fade-value { flex-shrink: 0; }
.foot-cross-fade-value { min-width: 38px; color: var(--text-2); font-size: 11px; text-align: right; font-variant-numeric: tabular-nums; }
.foot-next { min-width: 0; text-align: right; }
.foot-next-head { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.foot-next-label { color: var(--text-2); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; }
.foot-next-title { overflow: hidden; margin-top: 2px; color: var(--text-1); font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.foot-next-empty { margin-top: 4px; color: var(--text-muted); font-size: 13px; }
.foot-next-meta { margin-top: 2px; color: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.foot-next-clear { padding: 2px 6px; border: 0; border-radius: 4px; background: none; color: var(--text-2); font-family: inherit; font-size: 10px; letter-spacing: 0.04em; cursor: pointer; }
.foot-next-clear:hover { background: color-mix(in srgb, var(--danger) 8%, transparent); color: var(--danger); }

@media (max-width: 760px) {
  .music-lib-foot { grid-template-columns: 1fr; }
  .foot-cross { min-width: 0; padding: 0; }
  .foot-next { text-align: left; }
  .foot-next-head { justify-content: flex-start; }
}
</style>
