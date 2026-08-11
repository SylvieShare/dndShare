<template>
  <div
    v-if="editor.isFieldVisible(field)"
    class="iem-field"
    :class="editor.fieldClasses(field)"
  >
    <button
      v-if="editor.isCardField(field)"
      class="iem-card-head"
      type="button"
      :class="{ 'iem-card-head--open': editor.isSectionOpen(field.key) }"
      @click="editor.toggleSection(field.key)"
    >
      <span class="iem-card-head-name">{{ field.name }}</span>
      <svg class="iem-card-chevron" viewBox="0 0 16 16" fill="none" width="12" height="12">
        <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <label v-else-if="!editor.isBoolField(field)" class="iem-label">{{ field.name }}</label>

    <InputDescription
      v-if="field.type === 'description'"
      class="iem-description"
      editable
      :block="{ id: field.key, content: { placeholder: field.name + '...' } }"
      :value="editor.formData[field.key] || ''"
      @update:value="(_, value) => editor.formData[field.key] = value"
    />

    <button
      v-else-if="editor.isBoolField(field)"
      class="iem-toggle"
      :class="{ 'iem-toggle-on': !!editor.formData[field.key] }"
      type="button"
      role="switch"
      :aria-checked="!!editor.formData[field.key]"
      @click="editor.formData[field.key] = !editor.formData[field.key]"
    >
      <span class="iem-toggle-track"><span class="iem-toggle-thumb"></span></span>
      <span>{{ field.name }}</span>
    </button>

    <input
      v-else-if="field.type === 'int'"
      type="number"
      class="iem-input"
      :value="editor.formData[field.key] ?? ''"
      @input="editor.formData[field.key] = editor.numberOrNull($event.target.value)"
    />

    <select v-else-if="field.type === 'select'" class="iem-select" v-model="editor.formData[field.key]">
      <option value="">—</option>
      <option v-for="option in (field.options || [])" :key="option.value" :value="option.value">
        {{ option.label || option.value }}
      </option>
    </select>

    <ColorPresetPicker
      v-else-if="field.type === 'color'"
      inline
      allow-custom
      :model-value="editor.formData[field.key] ?? ''"
      @update:model-value="value => editor.formData[field.key] = value"
    />

    <div v-else-if="field.type === 'item'" class="iem-item-ref">
      <button
        type="button"
        class="iem-item-ref-btn"
        @click="editor.openItemPicker(field.item_type, (id) => editor.formData[field.key] = id)"
      >{{ editor.itemRefLabel(editor.formData[field.key]) }}</button>
      <button
        v-if="editor.formData[field.key] != null"
        type="button"
        class="iem-item-ref-clear"
        @click="editor.formData[field.key] = null"
      >×</button>
    </div>

    <div v-else-if="field.type === 'int_by_suggest'" class="iem-int-by-suggest">
      <input
        type="number"
        class="iem-input iem-int-by-suggest-input"
        :value="editor.intBySuggestValue(field.key).value ?? ''"
        @input="editor.setIntBySuggestField(field.key, 'value', editor.numberOrNull($event.target.value))"
      />
      <select
        class="iem-select"
        :value="editor.intBySuggestValue(field.key).suggest_id ?? ''"
        @change="editor.setIntBySuggestField(field.key, 'suggest_id', editor.numberOrNull($event.target.value))"
      >
        <option value="">—</option>
        <option
          v-for="suggest in editor.getSuggests(field.suggest_type_id)"
          :key="suggest.id"
          :value="suggest.id"
        >{{ suggest.value }}</option>
      </select>
    </div>

    <select
      v-else-if="field.type === 'dice'"
      class="iem-select"
      :value="editor.formData[field.key] ?? ''"
      @change="editor.formData[field.key] = $event.target.value || null"
    >
      <option value="">—</option>
      <option v-for="die in SYSTEM_DICE" :key="die.id" :value="die.id">{{ die.value }}</option>
    </select>

    <select
      v-else-if="field.type === 'suggest'"
      class="iem-select"
      :value="editor.formData[field.key] ?? ''"
      @change="editor.formData[field.key] = editor.numberOrNull($event.target.value)"
    >
      <option value="">—</option>
      <option
        v-for="suggest in editor.getSuggests(editor.getSuggestId(field))"
        :key="suggest.id"
        :value="suggest.id"
      >{{ suggest.value }}</option>
    </select>

    <div v-else-if="field.type === 'suggest_array'" class="iem-chip-row">
      <button
        v-for="id in (editor.formData[field.key] || [])"
        :key="id"
        class="iem-chip"
        type="button"
        @click="editor.removeArrayVal(field.key, id)"
      >{{ editor.getSuggestLabel(editor.getSuggestId(field), id) }} ×</button>
      <select class="iem-select iem-select-sm" value="" @change="editor.addArrayVal(field.key, $event)">
        <option value="">+ Добавить</option>
        <option v-for="suggest in editor.availableSuggests(field)" :key="suggest.id" :value="suggest.id">
          {{ suggest.value }}
        </option>
      </select>
    </div>

    <ItemObjectField v-else-if="field.type === 'object'" :field="field" />
    <ItemObjectArrayField v-else-if="field.type === 'object_array'" :field="field" />
    <ItemBlocksField v-else-if="field.type === 'blocks'" :field="field" />

    <input v-else type="text" class="iem-input" v-model="editor.formData[field.key]" />
  </div>
</template>

<script setup>
import { inject } from 'vue'
import ColorPresetPicker from '@/shared/ui/ColorPresetPicker'
import InputDescription from '@/shared/ui/InputDescription'
import ItemBlocksField from './ItemBlocksField.vue'
import ItemObjectArrayField from './ItemObjectArrayField.vue'
import ItemObjectField from './ItemObjectField.vue'
import { itemFieldEditorKey } from './useItemFieldEditor'
import { SYSTEM_DICE } from '@/shared/lib/systemDice'

defineProps({ field: { type: Object, required: true } })
const editor = inject(itemFieldEditorKey)
</script>
