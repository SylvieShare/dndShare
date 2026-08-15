<template>
  <div
    class="music-row"
    :class="{
      'music-row--playing': isPlaying,
      'music-row--queued': isQueued,
      'music-row--current': isCurrent && !isPlaying,
      'music-row--placeholder': isPlaceholder,
      'music-row--readonly': readOnly,
    }"
    :data-sortable-key="track.id"
  >
    <div
      v-if="draggable"
      class="music-row-drag"
      title="Перетащить"
      @pointerdown="onDragHandle"
    >
      <span class="dot" /><span class="dot" />
      <span class="dot" /><span class="dot" />
      <span class="dot" /><span class="dot" />
    </div>

    <button class="music-row-play" :title="isPlaying ? 'Пауза' : 'Играть'" @click="onPlay">
      <svg v-if="!isPlaying" width="12" height="12" viewBox="0 0 12 12">
        <path d="M3 1.5v9l7-4.5-7-4.5z" fill="currentColor"/>
      </svg>
      <svg v-else width="12" height="12" viewBox="0 0 12 12">
        <rect x="3" y="2" width="2.2" height="8" fill="currentColor"/>
        <rect x="6.8" y="2" width="2.2" height="8" fill="currentColor"/>
      </svg>
    </button>

    <div class="music-row-main">
      <span class="music-row-title" :title="track.name">{{ track.name }}</span>
      <span v-if="readOnly" class="music-row-system" title="Системный трек доступен всем и защищён от изменений">
        системный
      </span>
      <span v-if="isPlaying" class="music-row-state music-row-state--playing">ИГРАЕТ</span>
      <span v-else-if="isQueued" class="music-row-state music-row-state--queued">СЛЕДУЮЩИЙ</span>
    </div>

    <div class="music-row-tags">
      <span v-for="t in track.tags" :key="t.id" class="music-row-tag">{{ t.name }}</span>
    </div>

    <span class="music-row-time">{{ fmtTime(track.durationSec) }}</span>

    <button
      class="music-row-queue"
      :class="{ active: isQueued }"
      :disabled="isCurrent"
      :title="isCurrent ? 'Уже играет' : (isQueued ? 'В очереди' : 'В очередь')"
      @click="onQueue"
    >
      {{ isQueued ? 'в очереди' : 'след.' }}
    </button>

    <div v-if="!readOnly" class="music-row-menu-wrap" ref="menuWrap">
      <button class="music-row-menu" @click="menuOpen = !menuOpen">…</button>
      <div v-if="menuOpen" class="music-row-menu-pop">
        <button class="music-row-menu-item" @click="onChangeAlbums">Изменить альбом</button>
        <button class="music-row-menu-item" @click="onChangeTags">Теги</button>
        <button class="music-row-menu-item" @click="onRename">Переименовать</button>
        <button class="music-row-menu-item music-row-menu-item--danger" @click="onDelete">Удалить</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  track: { type: Object, required: true },
  isPlaying: { type: Boolean, default: false },
  isCurrent: { type: Boolean, default: false },
  isQueued: { type: Boolean, default: false },
  isPlaceholder: { type: Boolean, default: false },
  readOnly: { type: Boolean, default: false },
  draggable: { type: Boolean, default: false },
  onDragStart: { type: Function, default: null },
})
const emit = defineEmits(['play', 'queue-toggle', 'rename', 'delete', 'change-albums', 'change-tags'])

const menuOpen = ref(false)
const menuWrap = ref(null)

function onPlay() { emit('play', props.track) }
function onQueue() {
  if (props.isCurrent) return
  emit('queue-toggle', props.track)
}
function onChangeAlbums() { menuOpen.value = false; emit('change-albums', props.track) }
function onChangeTags() { menuOpen.value = false; emit('change-tags', props.track) }
function onRename() { menuOpen.value = false; emit('rename', props.track) }
function onDelete() { menuOpen.value = false; emit('delete', props.track) }

function onDragHandle(e) {
  if (props.onDragStart) props.onDragStart(e, props.track)
}

function onDocClick(e) {
  if (menuWrap.value && !menuWrap.value.contains(e.target)) menuOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}
</script>

<style scoped>
.music-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  transition: border-color 0.15s, background 0.15s;
}
.music-row:hover { border-color: var(--popover-bg); }
.music-row--playing {
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  border-color: var(--accent);
}
.music-row--current { border-color: var(--border-strong); }
.music-row--placeholder {
  background: transparent !important;
  border: 1px dashed var(--accent) !important;
}
.music-row--placeholder > * { visibility: hidden; }

.music-row-drag {
  flex-shrink: 0;
  width: 12px;
  height: 18px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  gap: 2px;
  cursor: grab;
  align-content: center;
  color: var(--text-muted);
  padding: 0 2px;
  margin-right: -6px;
}
.music-row-drag:hover { color: var(--text-2); }
.music-row-drag:active { cursor: grabbing; }
.music-row-drag .dot {
  width: 3px; height: 3px;
  border-radius: 50%;
  background: currentColor;
}

.music-row-play {
  width: 28px; height: 28px; flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid var(--surface-active);
  background: none;
  color: var(--text-2);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.music-row--playing .music-row-play {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--text-on-accent);
}
.music-row-play:hover { color: var(--accent); border-color: var(--accent); }
.music-row--playing .music-row-play:hover { color: var(--text-on-accent); }

.music-row-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; }
.music-row-title {
  font-size: 14px; color: var(--text-1);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  min-width: 0;
}
.music-row-state {
  font-size: 9px; letter-spacing: 0.1em; font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  flex-shrink: 0;
}
.music-row-state--playing { color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); }
.music-row-state--queued { color: var(--text-2); border: 1px dashed var(--surface-active); padding: 1px 6px; }
.music-row-system {
  flex-shrink: 0;
  color: var(--text-muted);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.music-row-tags { display: flex; gap: 6px; flex-wrap: wrap; flex-shrink: 0; max-width: 240px; }
.music-row-tag {
  font-size: 11px;
  color: var(--text-2);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-radius: 4px;
  padding: 2px 7px;
}

.music-row-time {
  font-size: 12px; color: var(--text-2);
  font-variant-numeric: tabular-nums;
  min-width: 42px; text-align: right;
}

.music-row-queue {
  font-size: 10px;
  color: var(--text-2);
  background: none;
  border: 1px solid var(--surface-active);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.music-row-queue:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.music-row-queue.active { background: var(--accent); color: var(--text-on-accent); border-color: var(--accent); }
.music-row-queue:disabled { opacity: 0.3; cursor: not-allowed; }

.music-row-menu-wrap { position: relative; }
.music-row-menu {
  background: none; border: none; color: var(--text-muted); font-size: 16px;
  cursor: pointer; padding: 2px 6px;
  line-height: 1;
}
.music-row-menu:hover { color: var(--text-2); }
.music-row-menu-pop {
  position: absolute; right: 0; top: calc(100% + 4px);
  background: var(--popover-bg);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  z-index: 50;
  min-width: 180px;
  padding: 4px;
  box-shadow: 0 6px 24px var(--scrim);
}
.music-row-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  color: var(--text-2);
  font: inherit; font-size: 13px;
  padding: 7px 10px;
  border-radius: 5px;
  cursor: pointer;
}
.music-row-menu-item:hover { background: var(--surface-raised); }
.music-row-menu-item--danger { color: var(--danger); }
.music-row-menu-item--danger:hover { background: color-mix(in srgb, var(--danger) 10%, transparent); }
</style>
