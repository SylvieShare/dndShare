<template>
  <div class="diary-dialogue">
    <div v-for="line in displayed" :key="line.id" class="diary-voice" :style="{ '--voice': line.color || 'var(--text-muted)' }">
      <JournalInlineForm v-if="active(line)" label="Реплика" :busy="busy" :error="error" @save="save" @cancel="$emit('cancel')">
        <FormTextInput v-model:value="editor.value.speaker" aria-label="Кто говорит" placeholder="Кто говорит" autofocus />
        <FormTextarea v-model:value="editor.value.text" aria-label="Текст реплики" placeholder="Текст реплики" :rows="3" />
        <template #actions><RemoveButton v-if="!editor.isNew" icon="trash" label="Удалить реплику" :disabled="busy" @click="$emit('save', { dialogue: lines.filter(row => row.id !== line.id) })" /></template>
      </JournalInlineForm>
      <template v-else>
        <span class="diary-speaker">{{ line.speaker || 'Рассказчик' }}</span>
        <p>{{ line.text || '…' }}</p>
        <JournalEditButton v-if="editable" :disabled="busy || Boolean(editor)" label="Редактировать реплику" @click="$emit('edit', 'dialogue', line)" />
      </template>
    </div>
    <button v-if="editable && !editor" class="diary-inline-add" type="button" :disabled="busy" @click="$emit('edit', 'dialogue', defaultDialogueLine(), true)"><Plus :size="15" /> Реплика</button>
    <p v-if="!displayed.length && !editable" class="diary-empty-copy">Реплики пока не добавлены.</p>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { Plus } from '@lucide/vue'
import JournalEditButton from '@/features/journals/components/JournalEditButton.vue'
import { FormTextInput, FormTextarea, RemoveButton } from '@sylvieshare/share-ui'
import JournalInlineForm from '@/features/journals/components/JournalInlineForm.vue'
import { defaultDialogueLine } from '../lib/diaryEntry'
import { hydrateDialogueRows } from '@/features/sessions/lib/dialogueRows'
const props = defineProps({ lines: { type: Array, default: () => [] }, editable: Boolean, busy: Boolean, editor: Object, error: String })
const emit = defineEmits(['edit', 'save', 'cancel'])
const displayed = computed(() => {
  const colors = hydrateDialogueRows(props.lines.map(line => ({ left: line.speaker, right: line.text, color: line.color })))
  const rows = props.lines.map((line, index) => ({ ...line, color: colors[index].color }))
  if (props.editor?.kind === 'dialogue' && props.editor.isNew) rows.push(props.editor.value)
  return rows
})
const active = line => props.editor?.kind === 'dialogue' && props.editor.value.id === line.id
function save() {
  const value = { ...props.editor.value }
  emit('save', { dialogue: props.editor.isNew ? [...props.lines, value] : props.lines.map(line => line.id === value.id ? value : line) })
}
</script>
<style scoped>
.diary-dialogue { display: flex; flex-direction: column; min-width: 0; }
.diary-voice { display: grid; grid-template-columns: minmax(66px, .18fr) minmax(0, 1fr) auto; gap: 12px; align-items: start; padding: 10px 0; }
.diary-voice :deep(.journal-inline-form) { grid-column: 1 / -1; padding: 0; }
.diary-speaker { font-size: 13px; font-weight: 750; color: var(--voice); line-height: 1.8; overflow-wrap: anywhere; }
.diary-voice p { margin: 0; padding-left: 14px; border-left: 2px solid var(--voice); color: var(--text-2); font-family: var(--font-prose); font-size: 14px; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 720px) {
  .diary-voice { gap: 8px; grid-template-columns: minmax(0, 1fr) auto; }
  .diary-speaker { font-size: 12px; }
  .diary-voice p { grid-column: 1; grid-row: 2; padding-left: 10px; font-size: 14px; }
  .diary-voice > .diary-pencil { grid-column: 2; grid-row: 1 / 3; }
}
</style>
