<template>
  <div class="input-desc">
    <div v-if="block.title || showToggle" class="desc-head">
      <span v-if="block.title" class="desc-title">{{ block.title }}</span>
      <button
        v-if="showToggle && !editOn"
        class="field-edit-btn"
        type="button"
        title="Редактировать"
        @click="editOn = true"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button v-else-if="showToggle" class="desc-done-btn" type="button" @click="editOn = false">Готово</button>
    </div>

    <div :class="{ 'desc-body--owner': showToggle && !editing }" @click="showToggle && !editing && (editOn = true)">
      <RichTextEditor
        :model-value="value"
        :editable="editing"
        :placeholder="block.content?.placeholder ?? 'Текст...'"
        :labels="RUSSIAN_LABELS"
        @update:model-value="$emit('update:value', block.id, $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { RichTextEditor } from '@sylvieshare/share-ui'

const RUSSIAN_LABELS = {
  toolbar: 'Форматирование текста',
  bold: 'Жирный',
  boldShort: 'Ж',
  italic: 'Курсив',
  italicShort: 'К',
  underline: 'Подчёркнутый',
  underlineShort: 'П',
  paragraph: 'Абзац',
  normal: 'Обычный текст',
  heading: 'Заголовок {level}',
  color: 'Цвет текста',
  colorShort: 'А',
  clearColor: 'Сбросить цвет',
}

const props = defineProps({
  block: { type: Object, default: () => ({}) },
  value: { type: String, default: '' },
  editable: { type: Boolean, default: false },
})
defineEmits(['update:value'])

const charCtx = inject('charCtx', { ownerMode: true })
const owner = computed(() => Boolean(charCtx.ownerMode))
const showToggle = computed(() => owner.value && !props.editable)
const editOn = ref(false)
const editing = computed(() => props.editable || (owner.value && editOn.value))
</script>

<style scoped>
.input-desc { display: flex; flex-direction: column; }
.desc-head { display: flex; align-items: center; gap: 8px; min-height: 24px; margin-bottom: 4px; }

.desc-title {
  min-width: 0;
  overflow: hidden;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.desc-head .field-edit-btn,
.desc-head .desc-done-btn { margin-left: auto; }

.field-edit-btn {
  display: grid;
  width: 24px;
  height: 24px;
  padding: 0;
  background: none;
  border: none;
  border-radius: var(--r-sm);
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.35;
  place-items: center;
  transition: color 0.15s, opacity 0.15s;
}

@media (hover: hover) {
  .input-desc:hover .field-edit-btn { color: var(--accent); opacity: 1; }
}

.field-edit-btn:focus-visible { color: var(--accent); opacity: 1; }

.desc-done-btn {
  padding: 3px 8px;
  background: none;
  border: none;
  border-radius: var(--r-sm);
  color: var(--accent);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s;
}

.desc-done-btn:hover { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
.desc-body--owner { cursor: text; }
</style>
