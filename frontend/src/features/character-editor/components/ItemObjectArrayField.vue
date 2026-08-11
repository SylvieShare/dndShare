<template>
  <div v-show="editor.isSectionOpen(field.key)" class="iem-object-array iem-card-body">
    <div
      v-for="(row, rowIndex) in editor.objectArrayValue(field.key)"
      :key="rowIndex"
      class="iem-object-row"
    >
      <div class="iem-object-row-fields">
        <template v-for="sub in (field.fields || [])" :key="sub.key">
          <div v-if="editor.isObjectArrayFieldVisible(field, row, sub)" class="iem-sub-field">
            <span v-if="!editor.isBoolField(sub)" class="iem-sub-label">{{ sub.name }}</span>
            <textarea
              v-if="sub.type === 'description'"
              class="iem-textarea"
              :value="row[sub.key] || ''"
              @input="editor.setObjectArrayField(field.key, rowIndex, sub.key, $event.target.value)"
            ></textarea>
            <button
              v-else-if="editor.isBoolField(sub)"
              class="iem-toggle"
              :class="{ 'iem-toggle-on': !!row[sub.key] }"
              type="button"
              role="switch"
              :aria-checked="!!row[sub.key]"
              @click="editor.setObjectArrayField(field.key, rowIndex, sub.key, !row[sub.key])"
            >
              <span class="iem-toggle-track"><span class="iem-toggle-thumb"></span></span>
              <span>{{ sub.name }}</span>
            </button>
            <input
              v-else-if="sub.type === 'int'"
              type="number"
              class="iem-input iem-input-sm"
              :value="row[sub.key] ?? ''"
              @input="editor.setObjectArrayField(field.key, rowIndex, sub.key, editor.numberOrNull($event.target.value))"
            />
            <select
              v-else-if="sub.type === 'select'"
              class="iem-select"
              :value="row[sub.key] ?? ''"
              @change="editor.setObjectArrayField(field.key, rowIndex, sub.key, $event.target.value)"
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
                @click="editor.openItemPicker(sub.item_type, (id) => editor.setObjectArrayField(field.key, rowIndex, sub.key, id))"
              >{{ editor.itemRefLabel(row[sub.key]) }}</button>
              <button
                v-if="row[sub.key] != null"
                type="button"
                class="iem-item-ref-clear"
                @click="editor.setObjectArrayField(field.key, rowIndex, sub.key, null)"
              >×</button>
            </div>
            <select
              v-else-if="sub.type === 'suggest'"
              class="iem-select"
              :value="row[sub.key] ?? ''"
              @change="editor.setObjectArrayField(field.key, rowIndex, sub.key, editor.numberOrNull($event.target.value))"
            >
              <option value="">—</option>
              <option
                v-for="suggest in editor.getSuggests(editor.getSuggestId(sub))"
                :key="suggest.id"
                :value="suggest.id"
              >{{ suggest.value }}</option>
            </select>

            <div v-else-if="sub.type === 'object_array'" class="iem-object-array iem-object-array-nested">
              <div
                v-for="(nestedRow, nestedIndex) in editor.rowObjectArrayValue(field.key, rowIndex, sub.key)"
                :key="nestedIndex"
                class="iem-object-row"
              >
                <div class="iem-object-row-fields">
                  <template v-for="nested in (sub.fields || [])" :key="nested.key">
                    <div v-if="editor.isObjectArrayFieldVisible(sub, nestedRow, nested)" class="iem-sub-field">
                      <span v-if="!editor.isBoolField(nested)" class="iem-sub-label">{{ nested.name }}</span>
                      <button
                        v-if="editor.isBoolField(nested)"
                        class="iem-toggle"
                        :class="{ 'iem-toggle-on': !!nestedRow[nested.key] }"
                        type="button"
                        @click="editor.setRowObjectArrayField(field.key, rowIndex, sub.key, nestedIndex, nested.key, !nestedRow[nested.key])"
                      >
                        <span class="iem-toggle-track"><span class="iem-toggle-thumb"></span></span>
                        <span>{{ nested.name }}</span>
                      </button>
                      <input
                        v-else-if="nested.type === 'int'"
                        type="number"
                        class="iem-input iem-input-sm"
                        :value="nestedRow[nested.key] ?? ''"
                        @input="editor.setRowObjectArrayField(field.key, rowIndex, sub.key, nestedIndex, nested.key, editor.numberOrNull($event.target.value))"
                      />
                      <select
                        v-else-if="nested.type === 'select'"
                        class="iem-select"
                        :value="nestedRow[nested.key] ?? ''"
                        @change="editor.setRowObjectArrayField(field.key, rowIndex, sub.key, nestedIndex, nested.key, $event.target.value)"
                      >
                        <option value="">—</option>
                        <option v-for="option in (nested.options || [])" :key="option.value" :value="option.value">
                          {{ option.label || option.value }}
                        </option>
                      </select>
                      <select
                        v-else-if="nested.type === 'suggest'"
                        class="iem-select"
                        :value="nestedRow[nested.key] ?? ''"
                        @change="editor.setRowObjectArrayField(field.key, rowIndex, sub.key, nestedIndex, nested.key, editor.numberOrNull($event.target.value))"
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
                        :value="nestedRow[nested.key] ?? ''"
                        @input="editor.setRowObjectArrayField(field.key, rowIndex, sub.key, nestedIndex, nested.key, $event.target.value)"
                      />
                    </div>
                  </template>
                </div>
                <button
                  class="iem-row-remove"
                  type="button"
                  @click="editor.removeRowObjectArrayRow(field.key, rowIndex, sub.key, nestedIndex)"
                >Удалить</button>
              </div>
              <button class="iem-row-add" type="button" @click="editor.addRowObjectArrayRow(field.key, rowIndex, sub)">
                + Добавить вариант
              </button>
            </div>

            <input
              v-else
              type="text"
              class="iem-input iem-input-sm"
              :value="row[sub.key] ?? ''"
              @input="editor.setObjectArrayField(field.key, rowIndex, sub.key, $event.target.value)"
            />
          </div>
        </template>
      </div>
      <button class="iem-row-remove" type="button" @click="editor.removeObjectArrayRow(field.key, rowIndex)">
        Удалить
      </button>
    </div>
    <button class="iem-row-add" type="button" @click="editor.addObjectArrayRow(field)">
      + Добавить
    </button>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { itemFieldEditorKey } from './useItemFieldEditor'

defineProps({ field: { type: Object, required: true } })
const editor = inject(itemFieldEditorKey)
</script>
