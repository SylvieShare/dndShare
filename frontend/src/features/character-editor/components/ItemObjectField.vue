<template>
  <div
    v-show="editor.isSectionOpen(field.key)"
    class="iem-object iem-card-body"
    :class="{ 'iem-object--horizontal': field.layout === 'horizontal' }"
  >
    <template v-for="sub in (field.fields || [])" :key="sub.key">
      <div v-if="editor.isNestedFieldVisible(field.key, sub)" class="iem-sub-field">
        <span v-if="!editor.isBoolField(sub)" class="iem-sub-label">{{ sub.name }}</span>

        <textarea
          v-if="sub.type === 'description'"
          class="iem-textarea"
          :value="editor.objectValue(field.key)[sub.key] || ''"
          @input="editor.setObjectField(field.key, sub.key, $event.target.value)"
        ></textarea>

        <button
          v-else-if="editor.isBoolField(sub)"
          class="iem-toggle"
          :class="{ 'iem-toggle-on': !!editor.objectValue(field.key)[sub.key] }"
          type="button"
          role="switch"
          :aria-checked="!!editor.objectValue(field.key)[sub.key]"
          @click="editor.setObjectField(field.key, sub.key, !editor.objectValue(field.key)[sub.key])"
        >
          <span class="iem-toggle-track"><span class="iem-toggle-thumb"></span></span>
          <span>{{ sub.name }}</span>
        </button>

        <input
          v-else-if="sub.type === 'int'"
          type="number"
          class="iem-input iem-input-sm"
          :value="editor.objectValue(field.key)[sub.key] ?? ''"
          @input="editor.setObjectField(field.key, sub.key, editor.numberOrNull($event.target.value))"
        />

        <select
          v-else-if="sub.type === 'select'"
          class="iem-select"
          :value="editor.objectValue(field.key)[sub.key] ?? ''"
          @change="editor.setObjectField(field.key, sub.key, $event.target.value)"
        >
          <option value="">—</option>
          <option v-for="option in (sub.options || [])" :key="option.value" :value="option.value">
            {{ option.label || option.value }}
          </option>
        </select>

        <div v-else-if="sub.type === 'item'" class="iem-item-ref">
          <button
            type="button"
            class="iem-item-ref-btn"
            @click="editor.openItemPicker(sub.item_type, (id) => editor.setObjectField(field.key, sub.key, id))"
          >{{ editor.itemRefLabel(editor.objectValue(field.key)[sub.key]) }}</button>
          <button
            v-if="editor.objectValue(field.key)[sub.key] != null"
            type="button"
            class="iem-item-ref-clear"
            @click="editor.setObjectField(field.key, sub.key, null)"
          >×</button>
        </div>

        <select
          v-else-if="sub.type === 'suggest'"
          class="iem-select"
          :value="editor.objectValue(field.key)[sub.key] ?? ''"
          @change="editor.setObjectField(field.key, sub.key, editor.numberOrNull($event.target.value))"
        >
          <option value="">—</option>
          <option
            v-for="suggest in editor.getSuggests(editor.getSuggestId(sub))"
            :key="suggest.id"
            :value="suggest.id"
          >{{ suggest.value }}</option>
        </select>

        <div v-else-if="sub.type === 'suggest_array'" class="iem-chip-row">
          <button
            v-for="id in (editor.objectValue(field.key)[sub.key] || [])"
            :key="id"
            class="iem-chip"
            type="button"
            @click="editor.removeNestedArrayVal(field.key, sub.key, id)"
          >{{ editor.getSuggestLabel(editor.getSuggestId(sub), id) }} ×</button>
          <select
            class="iem-select iem-select-sm"
            value=""
            @change="editor.addNestedArrayVal(field.key, sub.key, $event)"
          >
            <option value="">+ Добавить</option>
            <option
              v-for="suggest in editor.availableNestedSuggests(field.key, sub)"
              :key="suggest.id"
              :value="suggest.id"
            >{{ suggest.value }}</option>
          </select>
        </div>

        <div v-else-if="sub.type === 'object_array'" class="iem-object-array iem-object-array-nested">
          <div
            v-for="(row, rowIndex) in editor.nestedObjectArrayValue(field.key, sub.key)"
            :key="rowIndex"
            class="iem-object-row"
          >
            <div class="iem-object-row-fields">
              <template v-for="nested in (sub.fields || [])" :key="nested.key">
                <div v-if="editor.isObjectArrayFieldVisible(sub, row, nested)" class="iem-sub-field">
                  <span v-if="!editor.isBoolField(nested)" class="iem-sub-label">{{ nested.name }}</span>
                  <textarea
                    v-if="nested.type === 'description'"
                    class="iem-textarea"
                    :value="row[nested.key] || ''"
                    @input="editor.setNestedObjectArrayField(field.key, sub.key, rowIndex, nested.key, $event.target.value)"
                  ></textarea>
                  <button
                    v-else-if="editor.isBoolField(nested)"
                    class="iem-toggle"
                    :class="{ 'iem-toggle-on': !!row[nested.key] }"
                    type="button"
                    role="switch"
                    :aria-checked="!!row[nested.key]"
                    @click="editor.setNestedObjectArrayField(field.key, sub.key, rowIndex, nested.key, !row[nested.key])"
                  >
                    <span class="iem-toggle-track"><span class="iem-toggle-thumb"></span></span>
                    <span>{{ nested.name }}</span>
                  </button>
                  <input
                    v-else-if="nested.type === 'int'"
                    type="number"
                    class="iem-input iem-input-sm"
                    :value="row[nested.key] ?? ''"
                    @input="editor.setNestedObjectArrayField(field.key, sub.key, rowIndex, nested.key, editor.numberOrNull($event.target.value))"
                  />
                  <select
                    v-else-if="nested.type === 'select'"
                    class="iem-select"
                    :value="row[nested.key] ?? ''"
                    @change="editor.setNestedObjectArrayField(field.key, sub.key, rowIndex, nested.key, $event.target.value)"
                  >
                    <option value="">—</option>
                    <option v-for="option in (nested.options || [])" :key="option.value" :value="option.value">
                      {{ option.label || option.value }}
                    </option>
                  </select>
                  <div v-else-if="nested.type === 'item'" class="iem-item-ref">
                    <button
                      type="button"
                      class="iem-item-ref-btn"
                      @click="editor.openItemPicker(nested.item_type, (id) => editor.setNestedObjectArrayField(field.key, sub.key, rowIndex, nested.key, id))"
                    >{{ editor.itemRefLabel(row[nested.key]) }}</button>
                    <button
                      v-if="row[nested.key] != null"
                      type="button"
                      class="iem-item-ref-clear"
                      @click="editor.setNestedObjectArrayField(field.key, sub.key, rowIndex, nested.key, null)"
                    >×</button>
                  </div>
                  <select
                    v-else-if="nested.type === 'suggest'"
                    class="iem-select"
                    :value="row[nested.key] ?? ''"
                    @change="editor.setNestedObjectArrayField(field.key, sub.key, rowIndex, nested.key, editor.numberOrNull($event.target.value))"
                  >
                    <option value="">—</option>
                    <option
                      v-for="suggest in editor.getSuggests(editor.getSuggestId(nested))"
                      :key="suggest.id"
                      :value="suggest.id"
                    >{{ suggest.value }}</option>
                  </select>
                  <input
                    v-else
                    type="text"
                    class="iem-input iem-input-sm"
                    :value="row[nested.key] ?? ''"
                    @input="editor.setNestedObjectArrayField(field.key, sub.key, rowIndex, nested.key, $event.target.value)"
                  />
                </div>
              </template>
            </div>
            <button
              class="iem-row-remove"
              type="button"
              @click="editor.removeNestedObjectArrayRow(field.key, sub.key, rowIndex)"
            >Удалить</button>
          </div>
          <button class="iem-row-add" type="button" @click="editor.addNestedObjectArrayRow(field.key, sub)">
            + Добавить
          </button>
        </div>

        <input
          v-else
          type="text"
          class="iem-input iem-input-sm"
          :value="editor.objectValue(field.key)[sub.key] ?? ''"
          @input="editor.setObjectField(field.key, sub.key, $event.target.value)"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { itemFieldEditorKey } from './useItemFieldEditor'

defineProps({ field: { type: Object, required: true } })
const editor = inject(itemFieldEditorKey)
</script>
