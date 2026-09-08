<template>
  <div class="ddle">
    <div v-if="modelValue.length" class="ddle-list">
      <div v-for="(line, index) in modelValue" :key="line.id" class="ddle-line">
        <div class="ddle-line-head">
          <span class="ddle-number">{{ index + 1 }}</span>
          <RemoveButton icon="trash" label="Удалить реплику" @click="remove(index)" />
        </div>
        <FormTextInput
          :value="line.speaker"
          placeholder="Кто говорит"
          @update:value="value => update(index, { speaker: value })"
        />
        <FormTextarea
          :value="line.text"
          placeholder="Текст реплики"
          :rows="2"
          @update:value="value => update(index, { text: value })"
        />
      </div>
    </div>
    <div v-else class="ddle-empty">Добавьте первую реплику диалога</div>
    <button class="ddle-add" type="button" @click="add">+ Реплика</button>
  </div>
</template>

<script setup>
import { RemoveButton } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import { FormTextarea } from '@sylvieshare/share-ui'
import { defaultDialogueLine } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])

function add() {
  emit('update:modelValue', [...props.modelValue, defaultDialogueLine()])
}

function update(index, patch) {
  emit('update:modelValue', props.modelValue.map((line, i) => (i === index ? { ...line, ...patch } : line)))
}

function remove(index) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}
</script>

<style scoped>
.ddle { display: flex; flex-direction: column; gap: 9px; }
.ddle-list { display: flex; flex-direction: column; gap: 10px; }
.ddle-line {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 3%, var(--surface-raised));
}
.ddle-line-head { display: flex; align-items: center; justify-content: space-between; }
.ddle-number {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
}
.ddle-empty { font-size: 12px; color: var(--text-muted); font-style: italic; }
.ddle-add {
  align-self: flex-start;
  padding: 6px 11px;
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.ddle-add:hover { color: var(--accent); border-color: var(--accent); }
</style>
