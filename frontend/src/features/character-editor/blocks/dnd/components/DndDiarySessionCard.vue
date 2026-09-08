<template>
  <section class="dsc">
    <header class="dsc-head">
      <button class="dsc-heading" type="button" :aria-expanded="open" @click="open = !open">
        <span class="dsc-number">{{ String(number).padStart(2, '0') }}</span>
        <span class="dsc-heading-copy"><small>ГЛАВА ЛЕТОПИСИ</small><strong>{{ session.title || 'Раздел ' + number }}</strong></span>
        <span v-if="session.date" class="dsc-date">{{ session.date }}</span>
        <span class="dsc-count">Событий: {{ session.events.length }}</span>
        <ChevronDown :size="18" class="dsc-chevron" :class="{ 'dsc-chevron--open': open }" />
      </button>
      <button v-if="ownerMode" class="dsc-edit" type="button" :disabled="busy" title="Редактировать раздел" aria-label="Редактировать раздел" @click="$emit('edit-session', $event.currentTarget)">
        <Pencil :size="16" />
      </button>
    </header>

    <Transition name="dsc-expand">
      <div v-if="open" class="dsc-body">
        <div class="dsc-body-inner">
          <div class="dsc-body-content">
            <div class="dsc-timeline-head">
              <span><ArrowUp :size="15" /> НОВЫЕ СОБЫТИЯ СВЕРХУ</span>
              <button v-if="ownerMode" class="dsc-add" type="button" :disabled="busy" @click="$emit('add-event', $event.currentTarget)">
                <Plus :size="16" /> Добавить событие
              </button>
            </div>
            <div v-if="session.events.length" class="dsc-events" :data-sortable-container="group">
              <span class="dsc-rail" aria-hidden="true" />
              <article
                v-for="e in sortable.displayItems(group)"
                :key="e.id"
                class="dsc-event"
                :class="{ 'dsc-event--placeholder': sortable.isSource(e), 'dsc-event--editable': ownerMode }"
                :data-sortable-key="e.id"
                @click="editEvent(e, $event)"
              >
                <DndDiaryEventRow :event="e" />
                <div v-if="ownerMode" class="dsc-event-actions">
                  <button type="button" :disabled="busy" class="dsc-drag" title="Перетащите или используйте ↑ / ↓" aria-label="Порядок события: перетащите или используйте стрелки вверх и вниз"
                    @pointerdown.stop="startDrag(e, $event)" @click.stop
                    @keydown.up.prevent="moveEvent(e, -1)" @keydown.down.prevent="moveEvent(e, 1)">
                    <GripVertical :size="17" />
                  </button>
                  <button type="button" :disabled="busy" title="Редактировать событие" aria-label="Редактировать событие" @click.stop="$emit('edit-event', e.id, $event.currentTarget.closest('.dsc-event'))"><Pencil :size="15" /></button>
                </div>
              </article>
            </div>
            <div v-else class="dsc-empty"><Feather :size="25" /><span>История этой главы ещё не написана</span></div>
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { ArrowUp, ChevronDown, Feather, GripVertical, Pencil, Plus } from '@lucide/vue'
import { reorderByDrop, useSortable } from '@sylvieshare/share-ui'
import DndDiaryEventRow from './DndDiaryEventRow.vue'
import { diaryEventsNewestFirst } from '../lib/diaryEntry'

const props = defineProps({
  session: { type: Object, required: true },
  number: { type: Number, required: true },
  ownerMode: Boolean,
  busy: Boolean,
  defaultOpen: Boolean,
})
const emit = defineEmits(['edit-session', 'edit-event', 'add-event', 'reorder-events', 'dragging'])
const open = ref(props.defaultOpen)
const group = 'diary-' + useId()
const displayedEvents = computed(() => diaryEventsNewestFirst(props.session.events))
let dragSnapshot = ''
const eventKey = () => displayedEvents.value.map(event => event.id).join(',')
const sortable = useSortable({
  groups: { [group]: { items: displayedEvents } },
  getKey: event => event.id,
  canDropAt: () => props.ownerMode && !props.busy,
  onDrop: ({ fromIndex, toIndex }) => {
    if (props.ownerMode && !props.busy && dragSnapshot === eventKey() && fromIndex !== toIndex) {
      emit('reorder-events', reorderByDrop(displayedEvents.value, fromIndex, toIndex).map(e => e.id).reverse())
    }
  },
})
function startDrag(event, pointer) {
  if (!props.ownerMode || props.busy) return
  dragSnapshot = eventKey()
  sortable.startDrag(pointer, event, group, displayedEvents.value.findIndex(e => e.id === event.id))
}
function moveEvent(event, step) {
  if (!props.ownerMode || props.busy || sortable.dragging.value) return
  const index = displayedEvents.value.findIndex(e => e.id === event.id)
  const target = index + step
  if (target < 0 || target >= displayedEvents.value.length) return
  emit('reorder-events', reorderByDrop(displayedEvents.value, index, target).map(e => e.id).reverse())
}
function editEvent(event, pointer) {
  if (!props.ownerMode || props.busy || sortable.shouldSuppressClick()) return
  if (pointer.target.closest('button, a, input, [role="button"]')) return
  emit('edit-event', event.id, pointer.currentTarget)
}
watch(sortable.dragging, value => emit('dragging', value), { flush: 'sync' })
onBeforeUnmount(() => emit('dragging', false))
</script>

<style scoped>
.dsc { min-width: 0; border: 1px solid var(--border); border-radius: 20px; background: var(--surface); box-shadow: var(--shadow-sm); }
.dsc-head { display: flex; align-items: center; gap: 12px; padding: 22px 24px; }
.dsc-heading { display: flex; flex: 1; min-width: 0; align-items: center; gap: 16px; padding: 0; border: 0; background: none; color: var(--text-1); text-align: left; cursor: pointer; }
.dsc-number { flex: none; font-family: var(--font-display); font-size: 34px; color: var(--accent); opacity: .7; }
.dsc-heading-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 5px; }
.dsc-heading-copy small { color: var(--text-muted); font-size: 9px; font-weight: 750; letter-spacing: .16em; }
.dsc-heading-copy strong { font-family: var(--font-display); font-size: 22px; overflow-wrap: anywhere; }
.dsc-date, .dsc-count { color: var(--text-muted); font-size: 11px; }
.dsc-chevron { flex: none; transform: rotate(-90deg); transition: transform .2s; color: var(--text-muted); }
.dsc-chevron--open { transform: rotate(0); }
.dsc-edit, .dsc-event-actions button { display: grid; flex: none; place-items: center; width: 32px; height: 32px; padding: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-muted); cursor: pointer; }
.dsc-edit:hover, .dsc-event-actions button:hover { color: var(--accent); border-color: var(--accent); }
.dsc-body { display: grid; grid-template-rows: 1fr; opacity: 1; transition: grid-template-rows .2s ease, opacity .15s ease; }
.dsc-body-inner { min-height: 0; overflow: hidden; }
.dsc-expand-enter-from, .dsc-expand-leave-to { grid-template-rows: 0fr; opacity: 0; }
.dsc-body-content { display: flex; flex-direction: column; gap: 24px; padding: 24px 28px 32px; border-top: 1px solid var(--border); }
.dsc-timeline-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.dsc-timeline-head > span { display: flex; align-items: center; gap: 7px; color: var(--text-muted); font-size: 9px; font-weight: 750; letter-spacing: .12em; }
.dsc-add { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 16px; border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border)); border-radius: 10px; background: color-mix(in srgb, var(--accent) 10%, var(--surface)); color: var(--accent); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.dsc-add:hover { background: color-mix(in srgb, var(--accent) 18%, var(--surface)); }
.dsc-events { position: relative; display: flex; flex-direction: column; gap: 24px; }
.dsc-rail { position: absolute; top: 0; bottom: 24px; left: 21px; width: 3px; border-radius: 3px; background: linear-gradient(var(--accent), color-mix(in srgb, var(--accent) 30%, var(--border)) 35%, var(--border)); box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 12%, transparent); }
.dsc-event { position: relative; min-width: 0; }
.dsc-event--editable { cursor: pointer; }
.dsc-event--editable :deep(.der-heading), .dsc-event--editable :deep(.der-day-copy) { padding-right: 76px; }
.dsc-event-actions { position: absolute; z-index: 2; top: 18px; right: 16px; display: flex; gap: 4px; }
.dsc-event-actions .dsc-drag { cursor: grab; touch-action: none; }
.dsc-event-actions .dsc-drag:active { cursor: grabbing; }
.dsc-event--placeholder { border: 1px dashed var(--accent); border-radius: 16px; }
.dsc-event--placeholder > * { visibility: hidden; }
.dsc-empty { display: grid; min-height: 120px; justify-items: center; align-content: center; gap: 12px; color: var(--text-muted); font-size: 13px; }
button:disabled { opacity: .45; cursor: wait; }
@media (max-width: 720px) {
  .dsc-head { padding: 18px 16px; gap: 8px; }
  .dsc-number { font-size: 26px; }
  .dsc-heading { flex-wrap: wrap; gap: 10px; }
  .dsc-heading-copy strong { font-size: 19px; }
  .dsc-date, .dsc-count { display: none; }
  .dsc-body-content { padding: 18px 12px 24px; gap: 20px; }
  .dsc-events { gap: 20px; }
  .dsc-rail { left: 15px; width: 2px; }
  .dsc-event-actions { top: 12px; right: 10px; }
}
@media (prefers-reduced-motion: reduce) { .dsc-body, .dsc-chevron { transition: none; } }
</style>
