<template>
  <div v-show="editor.isSectionOpen(field.key)" class="iem-blocks iem-card-body">
    <div
      v-for="(block, index) in editor.blocksValue(field.key)"
      :key="index"
      class="iem-block-tile"
    >
      <input
        class="iem-input iem-block-name"
        :value="block.name"
        placeholder="Название блока..."
        @input="editor.setBlockField(field.key, index, 'name', $event.target.value)"
      />
      <InputDescription
        class="iem-description"
        editable
        :block="{ id: `${field.key}-${index}`, content: { placeholder: 'Описание...' } }"
        :value="block.value || ''"
        @update:value="(_, value) => editor.setBlockField(field.key, index, 'value', value)"
      />
      <div class="iem-block-actions">
        <button
          class="iem-block-move"
          type="button"
          :disabled="index === 0"
          @click="editor.moveBlock(field.key, index, -1)"
        >↑</button>
        <button
          class="iem-block-move"
          type="button"
          :disabled="index === editor.blocksValue(field.key).length - 1"
          @click="editor.moveBlock(field.key, index, 1)"
        >↓</button>
        <button class="iem-block-remove" type="button" @click="editor.removeBlock(field.key, index)">
          Удалить
        </button>
      </div>
    </div>
    <button class="iem-row-add" type="button" @click="editor.addBlock(field.key)">
      + Добавить блок
    </button>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import InputDescription from '@/shared/ui/InputDescription'
import { itemFieldEditorKey } from './useItemFieldEditor'

defineProps({ field: { type: Object, required: true } })
const editor = inject(itemFieldEditorKey)
</script>
