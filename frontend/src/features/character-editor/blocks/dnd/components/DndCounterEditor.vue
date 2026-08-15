<template>
  <EditorPanel compact>
    <EditorSection title="Плитка">
      <FormTextInput
        :value="counter.name"
        placeholder="Название"
        @update:value="v => $emit('update', { name: v })"
        @enter="blurOnEnter"
      />
      <div class="dce-field">
        <span class="dce-lab">Подпись</span>
        <FormTextInput
          :value="counter.unit"
          placeholder="дней, шт, факелов…"
          @update:value="v => $emit('update', { unit: v })"
          @enter="blurOnEnter"
        />
      </div>
    </EditorSection>

    <EditorSection title="Иконка">
      <IconPicker :model-value="counter.icon" @update:model-value="v => $emit('update', { icon: v })" />
    </EditorSection>

    <EditorSection title="Цвет">
      <ColorPresetPicker
        inline
        allow-clear
        :clear-value="''"
        :model-value="counter.color"
        @update:model-value="v => $emit('update', { color: v || '' })"
      />
    </EditorSection>

    <EditorSection title="Счётчик">
      <div class="dce-field">
        <span class="dce-lab">Значение</span>
        <FormNumberInput
          :value="counter.value"
          :min="0"
          :max="counter.max ?? undefined"
          @change="v => $emit('update', { value: v })"
        />
      </div>
      <div class="dce-field dce-field--max">
        <ToggleSwitch
          :model-value="counter.max != null"
          label="Максимум"
          @update:model-value="onToggleMax"
        />
        <FormNumberInput
          v-if="counter.max != null"
          :value="counter.max"
          :min="1"
          @change="v => $emit('update', { max: Math.max(1, v) })"
        />
      </div>
    </EditorSection>

    <div class="dce-foot">
      <button v-if="mode === 'create'" class="dce-cancel" type="button" @click="$emit('close')">Отмена</button>
      <button v-else class="dce-del" type="button" @click="$emit('remove')">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
        </svg>
        Удалить
      </button>
      <button
        class="dce-done"
        type="button"
        @click="mode === 'create' ? $emit('save') : $emit('close')"
      >{{ mode === 'create' ? 'Сохранить' : 'Готово' }}</button>
    </div>
  </EditorPanel>
</template>

<script setup>
import ColorPresetPicker from '@/shared/ui/ColorPresetPicker'
import EditorPanel from '@/features/character-editor/components/EditorPanel'
import EditorSection from '@/features/character-editor/components/EditorSection'
import { FormNumberInput } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import IconPicker from '@/shared/ui/IconPicker'
import ToggleSwitch from '@/shared/ui/ToggleSwitch'

const props = defineProps({
  counter: { type: Object, required: true },
  mode: { type: String, default: 'edit' },   // 'edit' → live tile | 'create' → draft, commit on save
})
const emit = defineEmits(['update', 'remove', 'close', 'save'])

function onToggleMax(on) {
  // Enabling defaults the max to the current value (so the bar reads full), with a floor of 1.
  emit('update', { max: on ? Math.max(1, props.counter.value || 0) : null })
}

function blurOnEnter(event) {
  event.target.blur()
}
</script>

<style scoped>
.dce-field { display: flex; flex-direction: column; gap: 6px; }
.dce-lab {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.dce-field--max { gap: 10px; }

.dce-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid var(--border);
  padding-top: 14px;
  margin-top: 2px;
}

.dce-del {
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
.dce-del:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }

.dce-cancel {
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
.dce-cancel:hover { color: var(--text-1); background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }

.dce-done {
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
.dce-done:hover { background: var(--accent-hover); }
</style>
