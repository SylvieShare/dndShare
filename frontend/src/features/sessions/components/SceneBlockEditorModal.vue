<template>
  <AppModalFrame :title="block ? 'Редактировать блок' : `Новый блок · ${typeLabel}`" wide @close="$emit('close')">
    <div class="scene-block-editor">
      <FormField label="Название" vertical>
        <FormTextInput v-model:value="draft.title" :maxlength="200" autofocus />
      </FormField>

      <FormField label="Цвет" vertical>
        <ColorPresetPicker
          inline
          allow-custom
          allow-clear
          clear-value=""
          :model-value="draft.color"
          @update:model-value="value => draft.color = value || ''"
        />
      </FormField>

      <FormField v-if="blockType === 'text'" label="Содержимое" vertical>
        <InputDescription
          editable
          :block="descriptionBlock"
          :value="draft.text"
          @update:value="(_, html) => draft.text = html"
        />
      </FormField>

      <FormField v-else label="Строки" vertical>
        <div class="scene-block-editor-rows">
          <div v-for="(row, index) in draft.rows" :key="index" class="scene-block-editor-row">
            <input v-model="row.left" placeholder="Ключ" />
            <input v-model="row.right" placeholder="Значение" />
            <button type="button" aria-label="Удалить строку" @click="draft.rows.splice(index, 1)">×</button>
          </div>
          <button type="button" class="scene-block-editor-add" @click="draft.rows.push({ left: '', right: '' })">+ Добавить строку</button>
        </div>
      </FormField>
    </div>

    <template #footer>
      <FormActionButtons
        :loading="saving"
        :can-submit="!!draft.title.trim()"
        @cancel="$emit('close')"
        @submit="save"
      />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, provide, reactive } from 'vue'
import AppModalFrame from '@/shared/ui/AppModalFrame.vue'
import ColorPresetPicker from '@/shared/ui/ColorPresetPicker'
import InputDescription from '@/shared/ui/InputDescription.vue'
import FormActionButtons from '@/shared/ui/form/FormActionButtons'
import FormField from '@/shared/ui/form/FormField'
import FormTextInput from '@/shared/ui/form/FormTextInput'

const props = defineProps({
  block: { type: Object, default: null },
  type: { type: String, default: 'text' },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'save'])

const blockType = computed(() => props.block?.type || props.type)
const typeLabel = computed(() => blockType.value === 'list' ? 'список' : 'текст')
const draft = reactive({
  title: props.block?.title || (blockType.value === 'list' ? 'Новый список' : 'Новый текст'),
  text: props.block?.data?.text || '',
  rows: Array.isArray(props.block?.data?.rows)
    ? props.block.data.rows.map(row => ({ left: String(row?.left ?? ''), right: String(row?.right ?? '') }))
    : [{ left: '', right: '' }],
  color: props.block?.color || '',
})
const descriptionBlock = { id: 'scene-block-description', content: { placeholder: 'Текст блока' } }

provide('charCtx', { ownerMode: false, dictionaries: {}, var: {} })

function save() {
  emit('save', {
    type: blockType.value,
    title: draft.title.trim(),
    color: draft.color || null,
    data: blockType.value === 'list'
      ? { rows: draft.rows.filter(row => row.left.trim() || row.right.trim()) }
      : { text: draft.text },
  })
}
</script>

<style scoped>
.scene-block-editor { display: flex; flex-direction: column; gap: 18px; }
.scene-block-editor-rows { display: flex; flex-direction: column; gap: 8px; }
.scene-block-editor-row { display: grid; grid-template-columns: minmax(100px, .8fr) minmax(160px, 1.4fr) 32px; gap: 8px; }
.scene-block-editor-row input {
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-raised);
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  outline: none;
}
.scene-block-editor-row input:focus { border-color: var(--accent); }
.scene-block-editor-row button,
.scene-block-editor-add {
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-raised);
  color: var(--text-2);
  font: inherit;
  cursor: pointer;
}
.scene-block-editor-row button:hover { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); }
.scene-block-editor-add { align-self: flex-start; padding: 7px 11px; font-size: 12px; }
.scene-block-editor-add:hover { color: var(--accent); border-color: var(--accent); }
</style>
