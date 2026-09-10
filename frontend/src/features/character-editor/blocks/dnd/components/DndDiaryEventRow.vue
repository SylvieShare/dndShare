<template>
  <BaseTile class="diary-event" :class="['diary-event--' + event.type, { 'diary-event--compact': compact }]" :color="meta.color" framed>
    <component :is="meta.icon" class="diary-event-watermark" :size="96" aria-hidden="true" />
    <header class="diary-event-header" :class="{ 'diary-event-header--draggable': draggable }"
      :tabindex="draggable ? 0 : undefined" :aria-label="draggable ? 'Переместить событие: перетащите заголовок или используйте стрелки вверх и вниз' : undefined"
      @pointerdown="drag" @keydown="move">
      <span class="diary-event-icon" :title="meta.label"><component :is="meta.icon" :size="23" /></span>
      <h3>{{ event.title || 'Без названия' }}</h3>
      <div class="diary-event-actions" @pointerdown.stop>
        <JournalEditButton v-if="editable" :disabled="controlsDisabled" label="Редактировать запись" @click="startEditing" />
        <DndDiaryEventMetadata :event="event" />
        <RemoveButton v-if="editable" icon="trash" label="Удалить событие" :disabled="controlsDisabled" @click="$emit('remove', event)" />
      </div>
    </header>
    <JournalInlineForm v-if="editor" class="diary-event-editor" label="Редактирование записи" :busy="busy || saving" :error="error" @save="save" @cancel="cancel">
      <JournalEventFields :value="editor.value" @update:value="editor.value = $event" />
    </JournalInlineForm>
    <div v-else-if="!headingOnly" class="diary-event-content">
      <DndDiaryDialogue v-if="event.type === 'dialog'" :lines="event.dialogue" />
      <DndDiaryCombatants v-if="event.type === 'battle'" :combatants="event.combatants" :items-by-id="itemsById" />
      <RichContent v-if="hasDesc" class="diary-event-prose" :html="descHtml" />
      <JournalQuest v-if="event.type === 'quest'" :value="event.quest" />
    </div>
  </BaseTile>
</template>
<script setup>
import { computed, watch } from 'vue'
import { BaseTile, RemoveButton } from '@sylvieshare/share-ui'
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
.diary-event { min-width: 0; --r-lg: 14px; isolation: isolate; }
.diary-event-watermark { position: absolute; z-index: 0; top: 8px; right: 12px; width: 96px; height: 96px; color: var(--tile-color); opacity: .035; pointer-events: none; user-select: none; stroke-width: 1.2; }
.diary-event-header { position: relative; z-index: 1; display: flex; align-items: center; gap: 10px; padding: 16px 20px; min-width: 0; border-radius: 14px 14px 0 0; border-bottom: 1px solid color-mix(in srgb, var(--tile-color) 14%, var(--border)); background: color-mix(in srgb, var(--tile-color) 3%, transparent); }
.diary-event-header--draggable { cursor: grab; touch-action: none; }
.diary-event-header--draggable:active { cursor: grabbing; }
.diary-event-header--draggable:hover { background: color-mix(in srgb, var(--tile-color) 5%, transparent); }
.diary-event-icon { display: grid; place-items: center; flex: none; width: 26px; height: 32px; color: var(--tile-color); }
.diary-event-header h3 { flex: 1; min-width: 0; margin: 0; color: var(--text-1); font: 700 clamp(23px, 2vw, 27px)/1.15 var(--font-display); overflow-wrap: anywhere; }
.diary-event-actions { display: flex; flex: none; align-items: center; gap: 3px; }
.diary-event-actions :deep(.diary-pencil) { margin: 0; }
.diary-event-content { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 12px; padding: 16px 22px 20px; }
.diary-event-prose { min-width: 0; color: var(--text-2); font-family: var(--font-prose); font-size: 14px; line-height: 1.8; overflow-wrap: anywhere; }
.diary-event-editor { position: relative; z-index: 1; padding: 18px 22px; }
.diary-event--header .diary-event-header, .diary-event--newday .diary-event-header { border-bottom: 0; border-radius: 14px; }
.diary-event--header h3 { font-size: 30px; }
.diary-event--compact .diary-event-header { padding: 14px 16px; }
.diary-event--compact .diary-event-header h3 { font-size: 22px; }
.diary-event :deep(.diary-empty-copy) { color: var(--text-muted); font: italic 13px/1.7 var(--font-prose); }
@media (max-width: 720px) {
  .diary-event-header { padding: 14px 12px; gap: 7px; }
  .diary-event-header h3 { font-size: 23px; }
  .diary-event-actions { margin-left: auto; }
  .diary-event-icon { width: 24px; }
  .diary-event-content, .diary-event-editor { padding: 14px 16px 18px; }
  .diary-event-prose { font-size: 13px; }
  .diary-event-watermark { width: 80px; height: 80px; right: 8px; }
}
@media (prefers-reduced-motion: reduce) { .diary-event { transition: none; } }
</style>
