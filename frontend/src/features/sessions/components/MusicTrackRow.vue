<template>
  <div
    class="music-row"
    :class="{
      'music-row--playing': isPlaying,
      'music-row--queued': isQueued,
      'music-row--current': isCurrent && !isPlaying,
      'music-row--placeholder': isPlaceholder,
      'music-row--selected': selected,
      'music-row--draggable': draggable,
    }"
    :data-sortable-key="track.id"
    @pointerdown="onPointerDown"
    @pointerup="onSelect"
  >
    <button class="music-row-play" :title="isPlaying ? 'Пауза' : 'Играть'" @click.stop="onPlay" @pointerdown.stop>
      <svg v-if="!isPlaying" width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5v9l7-4.5-7-4.5z" fill="currentColor"/></svg>
      <svg v-else width="12" height="12" viewBox="0 0 12 12"><rect x="3" y="2" width="2.2" height="8" fill="currentColor"/><rect x="6.8" y="2" width="2.2" height="8" fill="currentColor"/></svg>
    </button>
    <div class="music-row-main">
      <span class="music-row-title" :title="track.name">{{ track.name }}</span>
      <span v-if="system" class="music-row-system" title="Системный файл защищён, но личные альбомы и теги доступны">системный</span>
      <span v-if="isPlaying" class="music-row-state music-row-state--playing">ИГРАЕТ</span>
      <span v-else-if="isQueued" class="music-row-state music-row-state--queued">СЛЕДУЮЩИЙ</span>
    </div>
    <div class="music-row-tags">
      <span v-for="tag in track.tags" :key="tag.id" class="music-row-tag">{{ tag.name }}</span>
    </div>
    <span class="music-row-time">{{ fmtTime(track.durationSec) }}</span>
    <button
      class="music-row-queue"
      :class="{ active: isQueued }"
      :disabled="isCurrent"
      :title="isCurrent ? 'Уже играет' : (isQueued ? 'В очереди' : 'В очередь')"
      @click.stop="onQueue"
      @pointerdown.stop
    >{{ isQueued ? 'в очереди' : 'след.' }}</button>
    <div class="music-row-actions" @click.stop @pointerdown.stop>
      <RowActionMenu title="Действия с треком">
        <template #default="{ close }">
          <RowActionItem :icon="ListMusic" @click="run('change-albums', close)">Изменить альбомы</RowActionItem>
          <RowActionItem :icon="Tags" @click="run('change-tags', close)">Теги</RowActionItem>
          <RowActionItem v-if="!system" action="edit" @click="run('rename', close)">Переименовать</RowActionItem>
          <RowActionItem v-if="!system" action="delete" tone="danger" @click="run('delete', close)">Удалить</RowActionItem>
        </template>
      </RowActionMenu>
    </div>
  </div>
</template>

<script setup>
import { ListMusic, Tags } from '@lucide/vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'

const props = defineProps({
  track: { type: Object, required: true },
  isPlaying: { type: Boolean, default: false },
  isCurrent: { type: Boolean, default: false },
  isQueued: { type: Boolean, default: false },
  isPlaceholder: { type: Boolean, default: false },
  system: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  draggable: { type: Boolean, default: false },
  onDragStart: { type: Function, default: null },
})
const emit = defineEmits(['select', 'play', 'queue-toggle', 'rename', 'delete', 'change-albums', 'change-tags'])

function onSelect(event) {
  if (event.target.closest('button, a, input, label, [role="menuitem"]')) return
  emit('select', event, props.track)
}
function onPlay() { emit('play', props.track) }
function onQueue() { if (!props.isCurrent) emit('queue-toggle', props.track) }
function run(name, close) { close(); emit(name, props.track) }
function onPointerDown(event) {
  if (!props.draggable || !props.onDragStart) return
  if (event.target.closest('button, a, input, label, [role="menuitem"]')) return
  props.onDragStart(event, props.track)
}
function fmtTime(sec) {
  const total = Math.max(0, Math.floor(sec || 0))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
</script>

<style scoped>
.music-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border: 1px solid transparent; border-radius: 10px; background: transparent; transition: border-color 0.15s, background 0.15s; user-select: none; }
.music-row:hover { border-color: var(--popover-bg); }
.music-row--draggable { cursor: grab; }
.music-row--playing { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 7%, transparent); }
.music-row--current { border-color: var(--border-strong); }
.music-row--selected { border-color: color-mix(in srgb, var(--accent) 68%, var(--border)); background: color-mix(in srgb, var(--accent) 13%, transparent); }
.music-row--placeholder { border: 1px dashed var(--accent) !important; background: transparent !important; }
.music-row--placeholder > * { visibility: hidden; }
.music-row-play { width: 28px; height: 28px; display: flex; flex-shrink: 0; align-items: center; justify-content: center; border: 1px solid var(--surface-active); border-radius: 50%; background: none; color: var(--text-2); cursor: pointer; }
.music-row--playing .music-row-play { border-color: var(--accent); background: var(--accent); color: var(--text-on-accent); }
.music-row-play:hover { border-color: var(--accent); color: var(--accent); }
.music-row-main { min-width: 0; display: flex; flex: 1; align-items: center; gap: 10px; }
.music-row-title { min-width: 0; overflow: hidden; color: var(--text-1); font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.music-row-state { flex-shrink: 0; padding: 2px 7px; border-radius: 4px; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; }
.music-row-state--playing { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); }
.music-row-state--queued { padding: 1px 6px; border: 1px dashed var(--surface-active); color: var(--text-2); }
.music-row-system { flex-shrink: 0; padding: 1px 6px; border: 1px solid var(--border-strong); border-radius: 4px; color: var(--text-muted); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; }
.music-row-tags { max-width: 240px; display: flex; flex-shrink: 0; flex-wrap: wrap; gap: 6px; }
.music-row-tag { padding: 2px 7px; border-radius: 4px; background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--text-2); font-size: 11px; }
.music-row-time { min-width: 42px; color: var(--text-2); font-size: 12px; text-align: right; font-variant-numeric: tabular-nums; }
.music-row-queue { padding: 4px 10px; border: 1px solid var(--surface-active); border-radius: 6px; background: none; color: var(--text-2); font-family: inherit; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; }
.music-row-queue:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.music-row-queue.active { border-color: var(--accent); background: var(--accent); color: var(--text-on-accent); }
.music-row-queue:disabled { cursor: not-allowed; opacity: 0.3; }
.music-row-actions { flex-shrink: 0; }
</style>
