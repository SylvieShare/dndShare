<template>
  <section class="diary-section" :class="{ 'diary-section--readonly': !ownerMode }" role="tabpanel" :aria-label="session.title || 'Раздел дневника'">
    <div class="diary-section-toolbar">
      <MultiToggle v-model="filter" :options="filters" :disabled="blocked || sortable.dragging.value || reordering" aria-label="Показать записи" />
      <div v-if="ownerMode" class="diary-section-actions">
      <button v-if="ownerMode && session.events.length > 1" class="diary-order-toggle" type="button" :disabled="blocked || filter !== 'all'" :aria-pressed="reordering" title="Изменить порядок событий" aria-label="Изменить порядок событий" @click="reordering = !reordering"><ArrowUpDown :size="18" /></button>
      <JournalEditButton v-if="ownerMode" :disabled="blocked" label="Редактировать раздел" @click="$emit('edit-session')" />
      <JournalEventTypePicker v-if="ownerMode" :disabled="blocked" @create="$emit('create-event', $event)" />
      </div>
    </div>
    <div v-if="visibleEvents.length" class="diary-timeline" :data-sortable-container="group">
      <article v-for="event in visibleEvents" :key="event.id" :data-sortable-key="event.id" class="diary-timeline-event"
        :class="{ 'diary-timeline-event--placeholder': sortable.isSource(event), 'diary-timeline-event--day': event.type === 'newday' }">
        <div v-if="reordering && ownerMode" class="diary-order-actions">
          <button type="button" :disabled="blocked || displayedEvents[0]?.id === event.id" :aria-label="`Поднять событие: ${event.title || 'Без названия'}`" @click="moveEvent(event, -1)"><ArrowUp :size="18" /></button>
          <button type="button" :disabled="blocked || displayedEvents.at(-1)?.id === event.id" :aria-label="`Опустить событие: ${event.title || 'Без названия'}`" @click="moveEvent(event, 1)"><ArrowDown :size="18" /></button>
        </div>
        <DndDiaryEventRow :event="event" :allow-drag="!touchPointer && filter === 'all'" :editable="ownerMode" :busy="busy" :locked="Boolean(editingId) && editingId !== event.id"
          :focus-title="focusEventId === event.id" :save-event="saveEvent" :items-by-id="itemsById"
          @drag="startDrag(event, $event)" @move="moveEvent(event, $event)" @remove="$emit('remove-event', $event)" @editing="value => $emit('editing', event.id, value)" />
      </article>
    </div>
    <div v-else class="diary-timeline-empty"><Feather :size="32" /><strong>{{ filter === 'all' ? 'У каждой истории есть начало' : 'Таких записей пока нет' }}</strong><span>{{ ownerMode ? 'Добавьте событие, задание, диалог, бой или новый день.' : 'В этом разделе пока нет подходящих записей.' }}</span></div>
  </section>
</template>
<script setup>
import { computed, onMounted, onBeforeUnmount, ref, useId, watch } from 'vue'
import { ArrowUp, ArrowDown, ArrowUpDown, Feather } from '@lucide/vue'
import JournalEditButton from '@/features/journals/components/JournalEditButton.vue'
import { MultiToggle, reorderByDrop, useSortable } from '@sylvieshare/share-ui'
import JournalEventTypePicker from '@/features/journals/components/JournalEventTypePicker.vue'
import DndDiaryEventRow from '@/features/character-editor/blocks/dnd/components/DndDiaryEventRow.vue'
import { diaryEventsNewestFirst } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'
import { useItemReferenceMap } from '@/features/items/composables/useItemReferenceMap'
const props = defineProps({ session: { type: Object, required: true }, ownerMode: Boolean, busy: Boolean, editingId: String, focusEventId: String, saveEvent: { type: Function, required: true } })
const emit = defineEmits(['edit-session', 'create-event', 'remove-event', 'reorder-events', 'dragging', 'editing'])
const group = 'diary-' + useId()
const reordering = ref(false)
const filter = ref('all')
const filters = [{ value: 'all', label: 'Всё' }, { value: 'quest', label: 'Задания' }, { value: 'dialog', label: 'Диалоги' }]
const touchPointer = ref(false)
let pointerQuery
function readPointer() { touchPointer.value = pointerQuery.matches }
onMounted(() => {
  pointerQuery = window.matchMedia('(any-pointer: coarse)')
  readPointer()
  pointerQuery.addEventListener('change', readPointer)
})
onBeforeUnmount(() => pointerQuery?.removeEventListener('change', readPointer))
const blocked = computed(() => props.busy || Boolean(props.editingId))
const displayedEvents = computed(() => diaryEventsNewestFirst(props.session.events))
const itemIds = computed(() => props.session.events
  .filter(event => event.type === 'battle')
  .flatMap(event => (event.combatants || []).filter(creature => creature.source === 'handbook').map(creature => creature.itemId)))
const { itemsById } = useItemReferenceMap(itemIds)
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
const visibleEvents = computed(() => sortable.displayItems(group).filter(event => filter.value === 'all' || event.type === filter.value))
watch(() => props.focusEventId, id => { if (id) filter.value = 'all' })
function startDrag(event, pointer) {
  if (!props.ownerMode || blocked.value || filter.value !== 'all' || pointer.pointerType === 'touch') return
  dragSnapshot = eventKey()
  sortable.startDrag(pointer, event, group, displayedEvents.value.findIndex(row => row.id === event.id))
}
function moveEvent(event, step) {
  if (!props.ownerMode || blocked.value || filter.value !== 'all' || sortable.dragging.value) return
  const from = displayedEvents.value.findIndex(row => row.id === event.id)
  if (from + step < 0 || from + step >= displayedEvents.value.length) return
  emit('reorder-events', reorderByDrop(displayedEvents.value, from, from + step).map(row => row.id).reverse())
}
watch(sortable.dragging, value => emit('dragging', value), { flush: 'sync' })
onBeforeUnmount(() => emit('dragging', false))
</script>
<style scoped>
.diary-section { position: relative; min-width: 0; width: 100%; max-width: 1040px; align-self: center; box-sizing: border-box; padding-top: 0; }
.diary-section--readonly { padding-top: 0; }
.diary-section-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.diary-section-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.diary-order-toggle, .diary-order-actions button { display: grid; place-items: center; min-width: 40px; min-height: 40px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text-2); cursor: pointer; }
.diary-order-toggle[aria-pressed="true"] { color: var(--accent); border-color: var(--accent); }
.diary-order-actions { display: flex; justify-content: flex-end; gap: 6px; padding-bottom: 8px; }
.diary-order-actions button:disabled, .diary-order-toggle:disabled { opacity: .35; cursor: default; }
.diary-timeline { position: relative; display: flex; flex-direction: column; gap: 14px; padding: 8px 0 24px; }
.diary-timeline::before { content: ''; position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; background: var(--border-strong); }
.diary-timeline-event { position: relative; min-width: 0; }
.diary-timeline-event--day { width: calc(100% - 64px); align-self: center; }
.diary-timeline-event--placeholder { border: 1px dashed var(--accent); border-radius: 18px; }
.diary-timeline-event--placeholder > * { visibility: hidden; }
.diary-timeline-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; min-height: 240px; color: var(--text-muted); text-align: center; }
.diary-timeline-empty svg { color: var(--accent); opacity: .6; } .diary-timeline-empty strong { color: var(--text-2); font: 22px var(--font-display); } .diary-timeline-empty span { font-size: 13px; }
@media (max-width: 720px) { .diary-timeline { gap: 14px; } .diary-timeline-event--day { width: 100%; } }
</style>
