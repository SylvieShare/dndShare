<template>
  <EditorPanel compact>
    <EditorSection title="Сессия">
      <FormTextInput
        :value="session.title"
        :placeholder="titlePlaceholder"
        @update:value="v => $emit('update', { title: v })"
      />
      <div class="dse-field">
        <span class="dse-lab">Дата</span>
        <FormTextInput
          :value="session.date"
          placeholder="12 июля / 3-й день Хаммера…"
          @update:value="v => $emit('update', { date: v })"
        />
      </div>
    </EditorSection>

    <div class="dse-foot">
      <button v-if="mode === 'create'" class="dse-cancel" type="button" @click="$emit('close')">Отмена</button>
      <button v-else class="dse-del" type="button" @click="$emit('remove')">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
        </svg>
        Удалить
      </button>
      <button
        class="dse-done"
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

defineProps({
  session: { type: Object, required: true },
  titlePlaceholder: { type: String, default: 'Название сессии' },
  mode: { type: String, default: 'edit' },   // 'edit' → live session | 'create' → draft, commit on save
})
defineEmits(['update', 'remove', 'close', 'save'])
</script>

<style scoped>
.dse-field { display: flex; flex-direction: column; gap: 6px; }
.dse-lab {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.dse-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid var(--border);
  padding-top: 14px;
  margin-top: 2px;
}

.dse-del {
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
.dse-del:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }

.dse-cancel {
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
.dse-cancel:hover { color: var(--text-1); background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }

.dse-done {
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
.dse-done:hover { background: var(--accent-hover); }
</style>
