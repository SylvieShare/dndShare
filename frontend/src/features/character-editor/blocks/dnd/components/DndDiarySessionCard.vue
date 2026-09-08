<template>
  <section class="diary-section" role="tabpanel" :aria-label="session.title || 'Раздел дневника'">
    <header class="diary-section-heading">
      <div><h3>{{ session.title || 'Без названия' }}</h3><span v-if="session.date">{{ session.date }}</span></div>
      <JournalEditButton v-if="ownerMode" :disabled="blocked" label="Редактировать раздел" @click="$emit('edit-session')" />
    </header>
    <div class="diary-timeline-toolbar"><JournalEventTypePicker v-if="ownerMode" :disabled="blocked" @create="$emit('create-event', $event)" /><span><ArrowUp :size="14" /> Новые события сверху</span></div>
    <div v-if="session.events.length" class="diary-timeline" :data-sortable-container="group">
      <article v-for="event in sortable.displayItems(group)" :key="event.id" :data-sortable-key="event.id" class="diary-timeline-event"
        :class="{ 'diary-timeline-event--placeholder': sortable.isSource(event), 'diary-timeline-event--day': event.type === 'newday' }">
        <DndDiaryEventRow :event="event" :editable="ownerMode" :busy="busy" :locked="Boolean(editingId) && editingId !== event.id"
          :focus-title="focusEventId === event.id" :save-event="saveEvent"
          @drag="startDrag(event, $event)" @move="moveEvent(event, $event)" @remove="$emit('remove-event', $event)" @editing="value => $emit('editing', event.id, value)" />
      </article>
    </div>
    <div v-else class="diary-timeline-empty"><Feather :size="32" /><strong>У каждой истории есть начало</strong><span>{{ ownerMode ? 'Добавьте событие, диалог, бой или новый день.' : 'В этом разделе пока нет событий.' }}</span></div>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, useId, watch } from 'vue'
import { ArrowUp, Feather } from '@lucide/vue'
import JournalEditButton from '@/features/journals/components/JournalEditButton.vue'
import { reorderByDrop, useSortable } from '@sylvieshare/share-ui'
import JournalEventTypePicker from '@/features/journals/components/JournalEventTypePicker.vue'
import DndDiaryEventRow from './DndDiaryEventRow.vue'
import { diaryEventsNewestFirst } from '../lib/diaryEntry'
const props = defineProps({ session: { type: Object, required: true }, ownerMode: Boolean, busy: Boolean, editingId: String, focusEventId: String, saveEvent: { type: Function, required: true } })
const emit = defineEmits(['edit-session', 'create-event', 'remove-event', 'reorder-events', 'dragging', 'editing'])
const group = 'diary-' + useId()
const blocked = computed(() => props.busy || Boolean(props.editingId))
const displayedEvents = computed(() => diaryEventsNewestFirst(props.session.events))
let dragSnapshot = ''
const eventKey = () => displayedEvents.value.map(event => event.id).join(',')
const sortable = useSortable({
  groups: { [group]: { items: displayedEvents } }, getKey: event => event.id,
  canDropAt: () => props.ownerMode && !blocked.value,
  onDrop: ({ fromIndex, toIndex }) => {
    if (props.ownerMode && !blocked.value && dragSnapshot === eventKey() && fromIndex !== toIndex) {
      emit('reorder-events', reorderByDrop(displayedEvents.value, fromIndex, toIndex).map(event => event.id).reverse())
    }
  },
})
function startDrag(event, pointer) {
  if (!props.ownerMode || blocked.value) return
  dragSnapshot = eventKey()
  sortable.startDrag(pointer, event, group, displayedEvents.value.findIndex(row => row.id === event.id))
}
function moveEvent(event, step) {
  if (!props.ownerMode || blocked.value || sortable.dragging.value) return
  const from = displayedEvents.value.findIndex(row => row.id === event.id)
  if (from + step < 0 || from + step >= displayedEvents.value.length) return
  emit('reorder-events', reorderByDrop(displayedEvents.value, from, from + step).map(row => row.id).reverse())
}
watch(sortable.dragging, value => emit('dragging', value), { flush: 'sync' })
onBeforeUnmount(() => emit('dragging', false))
</script>
<style scoped>
.diary-section { min-width: 0; }
.diary-section-heading { display: flex; align-items: center; gap: 12px; padding: 4px 0 20px; }
.diary-section-heading > div { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; min-width: 0; }
.diary-section-heading h3 { margin: 0; font: 600 21px var(--font-display); color: var(--text-1); overflow-wrap: anywhere; }
.diary-section-heading span { color: var(--text-muted); font-size: 12px; }
.diary-timeline-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 26px; }
.diary-timeline-toolbar > span { display: flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: 11px; }
.diary-timeline { position: relative; display: flex; flex-direction: column; gap: 34px; padding: 8px 0 24px; }
.diary-timeline::before { content: ''; position: absolute; top: 0; bottom: 0; left: calc(50% - 1px); width: 2px; background: linear-gradient(var(--accent), color-mix(in srgb, var(--accent) 40%, var(--border))); }
.diary-timeline-event { position: relative; min-width: 0; }
.diary-timeline-event::before { content: ''; position: absolute; z-index: 3; top: -3px; left: calc(50% - 3px); width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
.diary-timeline-event--day { width: calc(100% - 64px); align-self: center; }
.diary-timeline-event--placeholder { border: 1px dashed var(--accent); border-radius: 18px; }
.diary-timeline-event--placeholder > * { visibility: hidden; }
.diary-timeline-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; min-height: 240px; color: var(--text-muted); text-align: center; }
.diary-timeline-empty svg { color: var(--accent); opacity: .6; } .diary-timeline-empty strong { color: var(--text-2); font: 22px var(--font-display); } .diary-timeline-empty span { font-size: 13px; }
@media (max-width: 720px) { .diary-timeline { gap: 26px; } .diary-timeline-event--day { width: calc(100% - 20px); } .diary-timeline-toolbar { flex-wrap: wrap; } }
</style>
