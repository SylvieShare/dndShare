<template>
  <EditorPanel compact>
    <EditorSection title="Задание">
      <FormTextInput
        :value="quest.title"
        placeholder="Название"
        @update:value="v => $emit('update', { title: v })"
      />
      <FormTextarea
        :value="quest.desc"
        placeholder="Что нужно сделать, кто дал задание…"
        :rows="5"
        @update:value="v => $emit('update', { desc: v })"
      />
      <FormTextarea
        :value="quest.reward"
        placeholder="Награда: золото, предмет, услуга…"
        :rows="2"
        @update:value="v => $emit('update', { reward: v })"
      />
    </EditorSection>

    <EditorSection title="Статус">
      <MultiToggle
        :options="statusOptions"
        :model-value="quest.status"
        block
        @update:model-value="v => $emit('update', { status: v })"
      />
    </EditorSection>

    <div class="dqe-foot">
      <button v-if="mode === 'create'" class="dqe-cancel" type="button" @click="$emit('close')">Отмена</button>
      <button v-else class="dqe-del" type="button" @click="$emit('remove')">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
        </svg>
        Удалить
      </button>
      <button
        class="dqe-done"
        type="button"
        @click="mode === 'create' ? $emit('save') : $emit('close')"
      >{{ mode === 'create' ? 'Сохранить' : 'Готово' }}</button>
    </div>
  </EditorPanel>
</template>

<script setup>
import EditorPanel from '@/features/character-editor/components/EditorPanel'
import EditorSection from '@/features/character-editor/components/EditorSection'
import FormTextInput from '@/shared/ui/form/FormTextInput'
import FormTextarea from '@/shared/ui/form/FormTextarea'
import MultiToggle from '@/shared/ui/MultiToggle'
import { QUEST_STATUSES } from '@/features/character-editor/blocks/dnd/lib/questEntry'

defineProps({
  quest: { type: Object, required: true },
  mode: { type: String, default: 'edit' },   // 'edit' → live quest | 'create' → draft, commit on save
})
defineEmits(['update', 'remove', 'close', 'save'])

const statusOptions = QUEST_STATUSES.map(s => ({ value: s.value, label: s.label }))
</script>

<style scoped>
.dqe-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid var(--border);
  padding-top: 14px;
  margin-top: 2px;
}

.dqe-del {
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
.dqe-del:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }

.dqe-cancel {
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
.dqe-cancel:hover { color: var(--text-1); background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }

.dqe-done {
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
.dqe-done:hover { background: var(--accent-hover); }
</style>
