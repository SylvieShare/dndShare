<template>
  <AppModalFrame extra-wide :title="quest ? 'Редактировать задание' : 'Новое задание'" @close="$emit('close')">
    <div class="quest-editor-layout">
      <div class="quest-editor-form">
        <SessionEditableField v-model="draft.name" label="Название" :icon="ScrollText" force-open :multiline="false" :maxlength="160" autofocus required placeholder="Что предстоит сделать?" />
        <FormField label="Статус" vertical>
          <div class="quest-status-grid">
            <button v-for="status in QUEST_STATUSES" :key="status.key" type="button" :class="{ active: draft.status === status.key }" :style="{ '--status-color': status.color }" @click="draft.status = status.key"><span />{{ status.label }}</button>
          </div>
        </FormField>
        <div class="quest-editor-fields">
          <SessionEditableField v-model="draft.goal" label="Цель" :icon="Target" force-open :rows="3" :maxlength="5000" placeholder="Что нужно достичь?" wide />
          <SessionEditableField v-model="draft.condition" label="Условие" :icon="KeyRound" force-open :rows="4" :maxlength="5000" placeholder="Что должно произойти или быть выполнено?" />
          <SessionEditableField v-model="draft.reward" label="Награда" :icon="Gift" force-open :rows="4" :maxlength="5000" placeholder="Что получат герои?" />
          <SessionEditableField v-model="draft.consequences" label="Последствия" :icon="GitFork" force-open :rows="4" :maxlength="5000" placeholder="Что изменится после успеха или провала?" />
          <SessionEditableField v-model="draft.notes" label="Заметки" :icon="NotebookPen" force-open :rows="4" :maxlength="5000" placeholder="Скрытые детали и напоминания мастеру" />
        </div>
      </div>
      <aside class="quest-editor-relations">
        <div><strong>Связи задания</strong><small>С чем и с кем оно связано</small></div>
        <UniversalRelationEditor v-model="draft.relations" :items="relationItems" source-type="quest" :source-id="quest?.id" />
      </aside>
    </div>
    <template #footer>
      <div class="quest-editor-footer">
        <button v-if="quest" type="button" class="quest-editor-delete" :disabled="saving" @click="$emit('delete', quest)">Удалить задание</button>
        <FormActionButtons :submit-text="quest ? 'Сохранить' : 'Создать задание'" :loading="saving" :can-submit="!!draft.name.trim()" @cancel="$emit('close')" @submit="submit" />
      </div>
    </template>
  </AppModalFrame>
</template>
<script setup>
import { reactive } from 'vue'
import { Gift, GitFork, KeyRound, NotebookPen, ScrollText, Target } from '@lucide/vue'
import { AppModalFrame, FormActionButtons, FormField } from '@sylvieshare/share-ui'
import SessionEditableField from '@/features/sessions/components/SessionEditableField.vue'
import UniversalRelationEditor from '@/features/sessions/components/UniversalRelationEditor.vue'
import { QUEST_STATUSES } from '@/features/sessions/lib/sessionEntityRelations'
const props = defineProps({ quest: { type: Object, default: null }, relationItems: { type: Array, default: () => [] }, saving: { type: Boolean, default: false } })
const emit = defineEmits(['close', 'save', 'delete'])
const draft = reactive({
  name: props.quest?.name || '',
  status: props.quest?.status || 'planned',
  goal: props.quest?.goal || '',
  condition: props.quest?.condition || '',
  reward: props.quest?.reward || '',
  consequences: props.quest?.consequences || '',
  notes: props.quest?.notes || '',
  relations: (props.quest?.relations || []).map(item => ({ ...item })),
})
function submit() {
  if (!draft.name.trim() || props.saving) return
  emit('save', {
    name: draft.name.trim(), status: draft.status,
    goal: draft.goal.trim() || null, condition: draft.condition.trim() || null,
    reward: draft.reward.trim() || null, consequences: draft.consequences.trim() || null,
    notes: draft.notes.trim() || null, relations: draft.relations,
  })
}
</script>
<style scoped>
.quest-editor-layout { display: grid; grid-template-columns: minmax(0,1.15fr) minmax(320px,.85fr); gap: 24px; }.quest-editor-form,.quest-editor-relations { min-width: 0; display: flex; flex-direction: column; gap: 14px; }.quest-editor-fields { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }.quest-editor-relations { padding-left: 22px; border-left: 1px solid var(--border); }.quest-editor-relations > div { display: flex; flex-direction: column; gap: 3px; }.quest-editor-relations strong { color: var(--text-1); font-size: 13px; }.quest-editor-relations small { color: var(--text-muted); font-size: 10px; }.quest-status-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 7px; }.quest-status-grid button { display: flex; align-items: center; gap: 7px; padding: 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-raised); color: var(--text-2); cursor: pointer; font: inherit; font-size: 11px; }.quest-status-grid button span { width: 8px; height: 8px; border-radius: 50%; background: var(--status-color); }.quest-status-grid button.active { border-color: var(--status-color); background: color-mix(in srgb,var(--status-color) 12%,var(--surface-raised)); color: var(--text-1); }.quest-editor-footer { width: 100%; display: flex; justify-content: space-between; gap: 16px; }.quest-editor-delete { border: 0; background: transparent; color: var(--danger); cursor: pointer; font: inherit; font-size: 12px; }@media(max-width:760px){.quest-editor-layout{grid-template-columns:1fr}.quest-editor-fields{grid-template-columns:1fr}.quest-editor-fields :deep(.session-editable-field--wide){grid-column:auto}.quest-editor-relations{padding:16px 0 0;border-top:1px solid var(--border);border-left:0}}
</style>
