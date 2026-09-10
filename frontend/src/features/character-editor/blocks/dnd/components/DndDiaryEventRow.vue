<template>
  <BaseTile class="diary-event" :class="['diary-event--' + event.type, { 'diary-event--compact': compact }]" :color="meta.color" :framed="event.type === 'quest'">
    <header class="diary-event-header" :class="{ 'diary-event-header--draggable': draggable, 'diary-event-header--editing': editor?.kind === 'title' }"
      :tabindex="draggable ? 0 : undefined" :aria-label="draggable ? 'Переместить событие: перетащите заголовок или используйте стрелки вверх и вниз' : undefined"
      @pointerdown="drag" @keydown="move">
      <span class="diary-event-icon" :style="{ color: meta.color }" :title="meta.label"><component :is="meta.icon" :size="24" /></span>
      <div class="diary-event-title">
        <JournalInlineForm v-if="editor?.kind === 'title'" label="Название события" :busy="busy || saving" :error="error" @save="submit({ title: editor.value })" @cancel="cancel">
          <FormTextInput v-model:value="editor.value" aria-label="Название события" placeholder="Дайте этому моменту имя" :maxlength="255" autofocus @enter="submit({ title: editor.value })" />
        </JournalInlineForm>
        <template v-else><h3>{{ event.title || 'Без названия' }}</h3><JournalEditButton v-if="editable" :disabled="controlsDisabled" label="Изменить название" @click="start('title', event.title)" /></template>
      </div>
      <RemoveButton v-if="editable" icon="trash" label="Удалить событие" :disabled="controlsDisabled" @click="$emit('remove', event)" />
    </header>
    <div v-if="event.type !== 'newday'" class="diary-event-content">
      <DndDiaryDialogue v-if="event.type === 'dialog'" :lines="event.dialogue" :editable="editable" :busy="busy || locked || saving" :editor="editor" :error="error"
        @edit="start" @save="submit" @cancel="cancel" />
      <DndDiaryCombatants v-if="event.type === 'battle'" :combatants="event.combatants" :items-by-id="itemsById" :editable="editable" :busy="busy || locked || saving" :editor="editor" :error="error"
        @edit="start" @save="submit" @cancel="cancel" />
      <JournalInlineForm v-if="editor?.kind === 'desc'" label="Описание события" :busy="busy || saving" :error="error" @save="submit({ desc: editor.value })" @cancel="cancel">
        <InputDescription :value="editor.value" :block="{ id: 'journal-desc', content: { placeholder: 'Что стоит запомнить?' } }" editable @update:value="(_id, value) => editor.value = value" />
      </JournalInlineForm>
      <div v-else-if="hasDesc || editable" class="diary-event-description">
        <RichContent v-if="hasDesc" class="diary-event-prose" :html="descHtml" />
        <span v-else class="diary-empty-copy">{{ event.type === 'event' ? 'Что произошло в этот момент?' : 'Добавить заметку' }}</span>
        <JournalEditButton v-if="editable" :disabled="controlsDisabled" label="Редактировать описание" @click="start('desc', event.desc)" />
      </div>
      <JournalQuest v-if="event.type === 'quest'" :value="event.quest" :editable="editable" :busy="busy || locked || saving" :editor="editor" :error="error"
        @edit="start" @save="submit" @cancel="cancel" @toggle="toggleObjective" @retry-toggle="saveObjectiveToggle" />
    </div>
    <DndDiaryEventMetadata class="diary-event-footer" :event="event" />
  </BaseTile>
</template>
<script setup>
import { computed, watch } from 'vue'
import JournalEditButton from '@/features/journals/components/JournalEditButton.vue'
import { BaseTile, FormTextInput, RemoveButton } from '@sylvieshare/share-ui'
import RichContent from '@/shared/ui/DndRichContent.vue'
import InputDescription from '@/shared/ui/InputDescription.vue'
import JournalInlineForm from '@/features/journals/components/JournalInlineForm.vue'
import { useJournalInlineEdit } from '@/features/journals/composables/useJournalInlineEdit'
import DndDiaryDialogue from './DndDiaryDialogue.vue'
import DndDiaryCombatants from './DndDiaryCombatants.vue'
import DndDiaryEventMetadata from './DndDiaryEventMetadata.vue'
import JournalQuest from '@/features/journals/components/JournalQuest.vue'
import { normalizeJournalQuest } from '@/features/journals/lib/journalQuest'
import { eventTypeMeta } from '../lib/diaryEntry'
const props = defineProps({ event: { type: Object, required: true }, itemsById: { type: Map, default: () => new Map() }, allowDrag: { type: Boolean, default: true }, compact: Boolean, editable: Boolean, busy: Boolean, locked: Boolean, focusTitle: Boolean, saveEvent: { type: Function, required: true } })
const emit = defineEmits(['drag', 'move', 'remove', 'editing'])
const { editor, error, saving, start, cancel, submit } = useJournalInlineEdit(props, emit)
const meta = computed(() => eventTypeMeta(props.event.type))
const controlsDisabled = computed(() => props.busy || props.locked || saving.value || Boolean(editor.value))
const draggable = computed(() => props.allowDrag && props.editable && !controlsDisabled.value)
function toggleObjective(objective, done) {
  start('quest-toggle', { ...objective, done })
  if (editor.value?.kind === 'quest-toggle') saveObjectiveToggle()
}
function saveObjectiveToggle() {
  const quest = normalizeJournalQuest(props.event.quest)
  const selected = editor.value.value
  submit({ quest: { ...quest, objectives: quest.objectives.map(row => row.id === selected.id ? { ...row, done: selected.done } : row) } })
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
watch(() => props.focusTitle, value => { if (value) start('title', props.event.title) }, { immediate: true })
function escapeHtml(text) { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
const descHtml = computed(() => /<[a-z][\s\S]*>/i.test(props.event.desc || '') ? props.event.desc : escapeHtml(props.event.desc || '').replace(/\n/g, '<br>'))
const hasDesc = computed(() => descHtml.value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '')
</script>
<style scoped>
.diary-event { min-width: 0; --r-lg: 14px; }
.diary-event-header { display: flex; align-items: flex-start; gap: 10px; padding: 18px 22px 10px; min-width: 0; border-radius: 14px 14px 0 0; }
.diary-event-header--draggable { cursor: grab; touch-action: none; }
.diary-event-header--draggable:active { cursor: grabbing; }
.diary-event-header--draggable:hover { background: color-mix(in srgb, var(--tile-color) 4%, transparent); }
.diary-event-icon { display: grid; place-items: center; flex: none; width: 28px; height: 34px; }
.diary-event-title { display: flex; flex: 1; min-width: 0; gap: 8px; align-items: center; min-height: 34px; }
.diary-event-title h3 { margin: 0; color: var(--text-1); font: 700 clamp(23px, 2vw, 27px)/1.15 var(--font-display); overflow-wrap: anywhere; }
.diary-event-title :deep(.journal-inline-form) { width: 100%; padding: 0; }
.diary-event-header--editing { flex-wrap: wrap; }
.diary-event-header--editing .diary-event-title { flex-basis: 100%; order: 3; }
.diary-event-header--editing > :last-child { margin-left: auto; }
.diary-event-header :deep(.remove-button) { margin-top: 1px; }
.diary-event-content { display: flex; flex-direction: column; gap: 10px; padding: 0 22px 8px; }
.diary-event-description { display: flex; align-items: flex-start; gap: 14px; min-width: 0; padding: 4px 0; }
.diary-event-prose { flex: 1; min-width: 0; color: var(--text-2); font-family: var(--font-prose); font-size: 14px; line-height: 1.8; overflow-wrap: anywhere; }
.diary-event-description > .diary-empty-copy { flex: 1; }
.diary-event-footer { padding: 0 22px 12px; }
.diary-event--newday .diary-event-header { padding-bottom: 14px; }
.diary-event--newday .diary-event-icon { border-radius: 50%; }
.diary-event--compact .diary-event-header { padding: 18px 16px 12px; gap: 8px; }
.diary-event--compact .diary-event-title h3 { font-size: 20px; }
.diary-event--compact .diary-event-icon { width: 32px; height: 32px; }
.diary-event--compact .diary-event-title { min-height: 32px; }
.diary-event--compact .diary-event-content { padding: 0 16px 8px; gap: 12px; }
.diary-event--compact .diary-event-prose { font-size: 14px; line-height: 1.65; }
.diary-event :deep(.diary-inline-add) { display: inline-flex; align-self: flex-start; align-items: center; gap: 7px; margin-top: 12px; padding: 7px 0; border: 0; background: transparent; color: var(--accent); font: 600 12px var(--font-ui); cursor: pointer; }
.diary-event :deep(.diary-inline-add:disabled) { opacity: .4; cursor: default; }
.diary-event :deep(.diary-empty-copy) { color: var(--text-muted); font: italic 13px/1.7 var(--font-prose); }
@media (max-width: 720px) {
  .diary-event-header { padding: 16px 16px 10px; gap: 8px; }
  .diary-event-icon { width: 24px; height: 34px; } .diary-event-icon svg { width: 20px; }
  .diary-event-title { min-height: 34px; } .diary-event-title h3 { font-size: 25px; }
  .diary-event-content { padding: 0 16px 8px; } .diary-event-prose { font-size: 13px; }
  .diary-event-footer { padding: 0 12px 12px; }
}
@media (prefers-reduced-motion: reduce) { .diary-event { transition: none; } }
</style>
