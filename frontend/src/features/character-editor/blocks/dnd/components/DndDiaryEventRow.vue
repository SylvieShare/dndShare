<template>
  <TimelineGroup class="diary-event" :class="['diary-event--' + event.type, { 'diary-event--compact': compact }]" :color="meta.color">
    <template #identity><span class="diary-event-icon" :title="meta.label" :style="{ color: meta.color }"><component :is="meta.icon" :size="23" /></span></template>
    <header class="diary-event-header" :class="{ 'diary-event-header--draggable': draggable }"
      :tabindex="draggable ? 0 : undefined" :aria-label="draggable ? 'Переместить событие: перетащите заголовок или используйте стрелки вверх и вниз' : undefined"
      @pointerdown="drag" @keydown="move">
      <h3>{{ event.title || 'Без названия' }}</h3>
      <div class="diary-event-actions" @pointerdown.stop>
        <JournalEditButton v-if="editable" :disabled="controlsDisabled" label="Редактировать запись" @click="startEditing" />
        <DndDiaryEventMetadata :event="event" />
        <RemoveButton v-if="editable" icon="trash" label="Удалить событие" :disabled="controlsDisabled" @click="$emit('remove', event)" />
      </div>
    </header>
    <div v-if="!editor && !headingOnly" class="diary-event-content">
      <DndDiaryDialogue v-if="event.type === 'dialog'" :lines="event.dialogue" />
      <DndDiaryCombatants v-if="event.type === 'battle'" :combatants="event.combatants" :items-by-id="itemsById" />
      <RichContent v-if="hasDesc" class="diary-event-prose" :html="descHtml" />
      <JournalQuest v-if="event.type === 'quest'" :value="event.quest" />
    </div>
    <template v-if="editor" #footer>
      <JournalInlineForm class="diary-event-editor" label="Редактирование записи" :busy="busy || saving" :error="error" @save="save" @cancel="cancel">
        <JournalEventFields :value="editor.value" :items-by-id="itemsById" @update:value="editor.value = $event" />
      </JournalInlineForm>
    </template>
  </TimelineGroup>
</template>
<script setup>
import { computed, watch } from 'vue'
import { TimelineGroup, RemoveButton } from '@sylvieshare/share-ui'
import JournalEditButton from '@/features/journals/components/JournalEditButton.vue'
import JournalInlineForm from '@/features/journals/components/JournalInlineForm.vue'
import JournalEventFields from '@/features/journals/components/JournalEventFields.vue'
import JournalQuest from '@/features/journals/components/JournalQuest.vue'
import { useJournalInlineEdit } from '@/features/journals/composables/useJournalInlineEdit'
import { normalizeJournalQuest } from '@/features/journals/lib/journalQuest'
import RichContent from '@/shared/ui/DndRichContent.vue'
import DndDiaryDialogue from './DndDiaryDialogue.vue'
import DndDiaryCombatants from './DndDiaryCombatants.vue'
import DndDiaryEventMetadata from './DndDiaryEventMetadata.vue'
import { eventTypeMeta } from '../lib/diaryEntry'
const props = defineProps({ event: { type: Object, required: true }, itemsById: { type: Map, default: () => new Map() }, allowDrag: { type: Boolean, default: true }, compact: Boolean, editable: Boolean, busy: Boolean, locked: Boolean, focusTitle: Boolean, saveEvent: { type: Function, required: true } })
const emit = defineEmits(['drag', 'move', 'remove', 'editing'])
const { editor, error, saving, start, cancel, submit } = useJournalInlineEdit(props, emit)
const meta = computed(() => eventTypeMeta(props.event.type))
const headingOnly = computed(() => ['newday', 'header'].includes(props.event.type))
const controlsDisabled = computed(() => props.busy || props.locked || saving.value || Boolean(editor.value))
const draggable = computed(() => props.allowDrag && props.editable && !controlsDisabled.value)
function startEditing() {
  start('entry', { ...props.event, dialogue: props.event.dialogue || [], combatants: props.event.combatants || [], quest: normalizeJournalQuest(props.event.quest) })
}
function save() {
  if (!editor.value) return
  const value = editor.value.value
  if (value.type === 'quest' && value.quest.objectives.some(row => !row.text.trim())) {
    error.value = 'Заполните или удалите пустые пункты задания'
    return
  }
  submit(value)
}
function drag(pointer) {
  if (!draggable.value || pointer.target.closest('button, input, textarea, a, [contenteditable="true"]')) return
  emit('drag', pointer)
}
function move(event) {
  if (!draggable.value || event.target !== event.currentTarget || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  emit('move', event.key === 'ArrowUp' ? -1 : 1)
}
watch(() => props.focusTitle, value => { if (value) startEditing() }, { immediate: true })
function escapeHtml(text) { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
const descHtml = computed(() => /<[a-z][\s\S]*>/i.test(props.event.desc || '') ? props.event.desc : escapeHtml(props.event.desc || '').replace(/\n/g, '<br>'))
const hasDesc = computed(() => descHtml.value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '')
</script>
<style scoped>
.diary-event { min-width: 0; container: diary-event / inline-size; }
.diary-event-header { display: flex; align-items: center; gap: 10px; min-width: 0; margin-bottom: 8px; }
.diary-event-header--draggable { cursor: grab; touch-action: none; }
.diary-event-header--draggable:active { cursor: grabbing; }
.diary-event-header--draggable:hover h3 { color: var(--accent-soft); }
.diary-event-icon { display: flex; align-items: center; width: 24px; height: 28px; }
.diary-event-header h3 { flex: 1; min-width: 0; margin: 0; color: var(--text-1); font: 650 17px/1.45 var(--font-ui); overflow-wrap: anywhere; }
.diary-event-actions { display: flex; flex: none; align-items: center; gap: 3px; }
.diary-event-actions :deep(.diary-pencil) { margin: 0; }
.diary-event-content { display: flex; flex-direction: column; gap: 10px; }
.diary-event-prose { min-width: 0; color: var(--text-2); font-family: var(--font-prose); font-size: 13px; line-height: 1.75; overflow-wrap: anywhere; }
.diary-event-editor { padding: 16px; border-radius: var(--r-md); background: var(--bg); }
.diary-event--header .diary-event-header, .diary-event--newday .diary-event-header { margin-bottom: 0; }
.diary-event--header h3, .diary-event--newday h3 { font: 650 21px/1.3 var(--font-display); }
.diary-event :deep(.diary-empty-copy) { color: var(--text-muted); font: italic 13px/1.7 var(--font-prose); }
@container diary-event (max-width: 420px) {
  .diary-event-header { flex-wrap: wrap; gap: 6px; }
  .diary-event-header h3 { flex-basis: 100%; font-size: 16px; }
  .diary-event-actions { width: 100%; justify-content: flex-end; }
  .diary-event-editor { padding: 12px; }
}
@media (prefers-reduced-motion: reduce) { .diary-event { transition: none; } }
</style>
