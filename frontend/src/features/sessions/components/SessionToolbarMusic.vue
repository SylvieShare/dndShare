<template>
  <div
    class="chapter-music-tab"
    :class="{
      'chapter-music-tab--active': primaryView === 'music',
      'chapter-music-tab--playing': musicState.playing && !musicState.loading,
    }"
    role="group"
    :aria-label="musicTabTitle"
  >
    <button
      type="button"
      class="chapter-primary-tab chapter-primary-tab--music"
      :title="musicTabTitle"
      :aria-current="primaryView === 'music' ? 'page' : undefined"
      aria-keyshortcuts="Alt+6"
      @click="emit('select-view', 'music')"
    >
      <Music2 :size="14" />
      <span ref="trackViewport" class="chapter-music-title"><span ref="trackLabel" class="chapter-music-title-text" :class="{ 'chapter-music-title-text--scrolling': overflow > 0 }" :style="marqueeStyle">{{ currentMusicTrack?.name || 'Музыка' }}</span></span>
      <span v-if="currentMusicTrack" class="chapter-music-state" aria-hidden="true" />
      <kbd v-if="showShortcutHints" class="chapter-shortcut-hint" aria-hidden="true">{{ shortcutLabels.alt }}+6</kbd>
    </button>
    <div v-if="currentMusicTrack" class="chapter-music-controls">
      <button
        type="button"
        class="chapter-music-control"
        :title="musicPlayLabel"
        :aria-label="musicPlayLabel"
        :aria-busy="musicState.loading"
        @click="toggleMusicPlayback"
      >
        <MusicLoadingIndicator v-if="musicState.loading" :size="13" />
        <Pause v-else-if="musicState.playing" :size="13" fill="currentColor" />
        <Play v-else :size="13" fill="currentColor" />
      </button>
      <button
        type="button"
        class="chapter-music-control"
        title="Следующий трек"
        aria-label="Следующий трек"
        :disabled="!playbackNextTrack"
        @click="musicStore.playNext()"
      >
        <SkipForward :size="14" fill="currentColor" />
      </button>
    </div>
    <span v-if="currentMusicTrack" class="chapter-music-progress" aria-hidden="true">
      <span :style="{ width: `${musicProgressPct}%` }" />
    </span>
  </div>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Music2, Pause, Play, SkipForward } from '@lucide/vue'
import { useMusicStore } from '@/stores/music'
import { sessionShortcutLabels } from '../lib/sessionShortcuts'
import MusicLoadingIndicator from './MusicLoadingIndicator.vue'
defineProps({ primaryView: String, showShortcutHints: Boolean })
const emit = defineEmits(['select-view'])
const shortcutLabels = sessionShortcutLabels()
const musicStore = useMusicStore()
const {
  state: musicState,
  currentTrack: currentMusicTrack,
  playbackNextTrack,
  remotePlayback,
} = storeToRefs(musicStore)
const musicProgressPct = computed(() => musicState.value.durationSec
  ? Math.min(100, Math.max(0, musicState.value.positionSec / musicState.value.durationSec * 100))
  : 0)
const musicTabTitle = computed(() => {
  if (!currentMusicTrack.value) return 'Музыка'
  const status = musicState.value.loading ? 'ЗАГРУЗКА…' : musicState.value.playbackError ? 'ОШИБКА ЗАГРУЗКИ' : musicState.value.playing
    ? remotePlayback.value ? 'НА ЭКРАНЕ' : 'ИГРАЕТ'
    : 'ПАУЗА'
  return `${currentMusicTrack.value.name} · ${status}`
})
const musicPlayLabel = computed(() => musicState.value.loading ? 'Загрузка трека — отменить'
  : musicState.value.playing ? 'Поставить музыку на паузу' : 'Продолжить музыку')

const trackViewport = ref(null)
const trackLabel = ref(null)
const overflow = ref(0)
let observer
const measure = () => { overflow.value = Math.max(0, (trackLabel.value?.scrollWidth || 0) - (trackViewport.value?.clientWidth || 0)) }
const marqueeStyle = computed(() => ({ '--track-overflow': `${-overflow.value}px`, '--track-duration': `${Math.max(6, overflow.value / 22 + 3)}s` }))
watch(() => currentMusicTrack.value?.name, async () => { await nextTick(); measure() })
onMounted(() => {
  observer = new ResizeObserver(measure)
  observer.observe(trackViewport.value)
  observer.observe(trackLabel.value)
  measure()
})
onBeforeUnmount(() => observer?.disconnect())
function toggleMusicPlayback() {
  if (!currentMusicTrack.value) return
  if (musicState.value.playing || musicState.value.loading) musicStore.pause()
  else musicStore.resume()
}
</script>
<style scoped>
.chapter-music-tab { justify-self: end; align-self: center; }
.chapter-primary-tab--music { position: relative; display: inline-flex; align-items: center; gap: 6px; min-height: 31px; padding: 6px 9px; border: 0; background: transparent; color: var(--text-2); font: 700 11px var(--font-ui); cursor: pointer; }
.chapter-primary-tab--music:hover { color: var(--text-1); }
.chapter-music-title { width: 48px; overflow: hidden; text-align: left; }
.chapter-music-title-text { display: block; width: max-content; white-space: nowrap; }
.chapter-music-title-text--scrolling { animation: chapter-track-scroll var(--track-duration) ease-in-out infinite alternate; }
@keyframes chapter-track-scroll { 0%, 15% { transform: translateX(0); } 85%, 100% { transform: translateX(var(--track-overflow)); } }
.chapter-shortcut-hint { position: absolute; inset: auto 0 0; font: 8px var(--font-ui); text-align: center; }
.chapter-music-tab {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  overflow: hidden;
  border-radius: 7px;
  transition: background 0.15s, color 0.15s;
}
.chapter-music-tab--active { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.chapter-primary-tab--music::after { display: none; }
.chapter-music-state {
  width: 5px;
  height: 5px;
  flex: none;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.62;
}
.chapter-music-tab--playing .chapter-music-state {
  opacity: 1;
  animation: chapter-music-live 1.8s ease-in-out infinite;
}
.chapter-music-controls { display: inline-flex; align-items: center; padding-right: 3px; }
.chapter-music-control {
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-left: 1px solid color-mix(in srgb, var(--border-strong) 70%, transparent);
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, opacity 0.15s;
}
.chapter-music-control:hover:not(:disabled) { background: color-mix(in srgb, var(--text-on-accent) 8%, transparent); color: var(--text-1); }
.chapter-music-control:disabled { cursor: not-allowed; opacity: 0.28; }
.chapter-music-progress {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  overflow: hidden;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  pointer-events: none;
}
.chapter-music-progress > span {
  display: block;
  height: 100%;
  border-radius: 0 2px 2px 0;
  background: var(--accent);
  transition: width 0.45s linear;
}
@keyframes chapter-music-live { 50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); } }

@media (prefers-reduced-motion: reduce) {
  .chapter-music-title-text--scrolling, .chapter-music-tab--playing .chapter-music-state { animation: none; }
  .chapter-music-title-text { width: auto; overflow: hidden; text-overflow: ellipsis; }
}
</style>
