<template>
  <EditorPanel compact>
    <EditorSection title="Тип">
      <MultiToggle
        :options="typeOptions"
        :model-value="event.type"
        block
        @update:model-value="v => $emit('update', { type: v })"
      />
    </EditorSection>

    <EditorSection :title="event.type === 'newday' ? 'День' : 'Событие'">
      <FormTextInput
        :value="event.title"
        :placeholder="event.type === 'newday' ? 'Например, День 12' : 'Заголовок'"
        autofocus
        @update:value="v => $emit('update', { title: v })"
      />
      <InputDescription
        v-if="event.type === 'event'"
        class="dee-desc"
        :block="descBlock"
        :value="event.desc"
        editable
        @update:value="(id, html) => $emit('update', { desc: html })"
      />
    </EditorSection>

    <EditorSection v-if="event.type === 'dialog'" title="Реплики">
      <DndDialogueLinesEditor
        :model-value="event.dialogue"
        @update:model-value="dialogue => $emit('update', { dialogue })"
      />
    </EditorSection>

    <EditorSection v-if="event.type === 'battle'" title="Участники боя">
      <DndBattleCombatantsEditor
        :model-value="event.combatants"
        @update:model-value="combatants => $emit('update', { combatants })"
      />
    </EditorSection>

    <EditorSection v-if="hasLegacyDescription" title="Сохранённое ранее описание">
      <div class="dee-legacy-hint">Оно сохранено отдельно от новых структурированных данных.</div>
      <InputDescription
        class="dee-desc"
        :block="legacyDescBlock"
        :value="event.desc"
        editable
        @update:value="(id, html) => $emit('update', { desc: html })"
      />
    </EditorSection>

    <div class="dee-foot">
      <button v-if="mode === 'create'" class="dee-cancel" type="button" @click="$emit('close')">Отмена</button>
      <button v-else class="dee-del" type="button" @click="$emit('remove')">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
        </svg>
        Удалить
      </button>
      <button
        class="dee-done"
        type="button"
        @click="mode === 'create' ? $emit('save') : $emit('close')"
      >{{ mode === 'create' ? 'Сохранить' : 'Готово' }}</button>
    </div>
  </EditorPanel>
</template>

<script setup>
import { computed } from 'vue'
import DndBattleCombatantsEditor from '@/features/character-editor/blocks/dnd/components/DndBattleCombatantsEditor.vue'
import DndDialogueLinesEditor from '@/features/character-editor/blocks/dnd/components/DndDialogueLinesEditor.vue'
import EditorPanel from '@/features/character-editor/components/EditorPanel'
import EditorSection from '@/features/character-editor/components/EditorSection'
import FormTextInput from '@/shared/ui/form/FormTextInput'
import InputDescription from '@/shared/ui/InputDescription'
import MultiToggle from '@/shared/ui/MultiToggle'
import { EVENT_TYPES } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'

const props = defineProps({
  event: { type: Object, required: true },
  mode: { type: String, default: 'edit' },   // 'edit' → live event | 'create' → draft, commit on save
})
defineEmits(['update', 'remove', 'close', 'save'])

const typeOptions = EVENT_TYPES.map(t => ({ value: t.value, label: t.label }))
const descBlock = { id: 'desc', content: { placeholder: 'Что произошло…' } }
const legacyDescBlock = { id: 'legacy-desc', content: { placeholder: 'Старое описание' } }
const hasLegacyDescription = computed(() =>
  (props.event.type === 'dialog' || props.event.type === 'battle') && !!props.event.desc,
)
</script>

<style scoped>
.dee-legacy-hint { font-size: 11px; line-height: 1.4; color: var(--text-muted); }
.dee-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid var(--border);
  padding-top: 14px;
  margin-top: 2px;
}

.dee-del {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  padding: 7px 10px;
  border-radius: 8px;
  transition: color 0.12s, background 0.12s;
}
.dee-del:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }

.dee-cancel {
  background: none;
  border: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  padding: 7px 10px;
  border-radius: 8px;
  transition: color 0.12s, background 0.12s;
}
.dee-cancel:hover { color: var(--text-1); background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }

.dee-done {
  background: var(--accent);
  border: none;
  color: var(--text-on-accent);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 8px;
  transition: background 0.12s;
}
.dee-done:hover { background: var(--accent-hover); }
</style>
