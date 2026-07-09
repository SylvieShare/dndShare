<template>
  <AppModal wide tile :z-index="4500" @close="$emit('close')">
    <div class="iem-title">{{ item ? 'Редактировать предмет' : 'Новый предмет' }}</div>

    <!-- Name -->
    <div class="iem-field">
      <label class="iem-label">Название</label>
      <input
        ref="nameInput"
        v-model="formName"
        class="iem-input"
        placeholder="Название..."
        @keydown.enter.prevent="submit"
      />
    </div>

    <div v-if="showNameEn" class="iem-field">
      <label class="iem-label">EN</label>
      <input
        v-model="formNameEn"
        class="iem-input"
        placeholder="English name..."
        @keydown.enter.prevent="submit"
      />
    </div>

    <!-- Schema fields -->
    <div class="iem-fields-grid">
    <template v-for="field in typeFields" :key="field.key">
      <div
        v-if="isFieldVisible(field)"
        class="iem-field"
        :class="fieldClasses(field)"
      >
        <!-- Card header (collapsible) for object / object_array / blocks -->
        <button
          v-if="isCardField(field)"
          class="iem-card-head"
          type="button"
          :class="{ 'iem-card-head--open': isSectionOpen(field.key) }"
          @click="toggleSection(field.key)"
        >
          <span class="iem-card-head-name">{{ field.name }}</span>
          <svg class="iem-card-chevron" viewBox="0 0 16 16" fill="none" width="12" height="12">
            <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <label
          v-else-if="!isBoolField(field)"
          class="iem-label"
        >{{ field.name }}</label>

        <!-- description (rich text) -->
        <template v-if="field.type === 'description'">
          <InputDescription
            class="iem-description"
            :block="{ id: field.key, content: { placeholder: field.name + '...' } }"
            :value="formData[field.key] || ''"
            @update:value="(_, value) => formData[field.key] = value"
          />
        </template>

        <!-- bool -->
        <template v-else-if="isBoolField(field)">
          <button
            class="iem-toggle"
            :class="{ 'iem-toggle-on': !!formData[field.key] }"
            type="button"
            role="switch"
            :aria-checked="!!formData[field.key]"
            @click="formData[field.key] = !formData[field.key]"
          >
            <span class="iem-toggle-track"><span class="iem-toggle-thumb"></span></span>
            <span>{{ field.name }}</span>
          </button>
        </template>

        <!-- int -->
        <template v-else-if="field.type === 'int'">
          <input
            type="number"
            class="iem-input"
            :value="formData[field.key] ?? ''"
            @input="formData[field.key] = $event.target.value === '' ? null : Number($event.target.value)"
          />
        </template>

        <!-- color (hex swatch picker) -->
        <template v-else-if="field.type === 'color'">
          <ColorPresetPicker
            inline
            allow-custom
            :model-value="formData[field.key] ?? ''"
            @update:model-value="v => formData[field.key] = v"
          />
        </template>

        <!-- item (reference to another handbook item) -->
        <template v-else-if="field.type === 'item'">
          <div class="iem-item-ref">
            <button
              type="button"
              class="iem-item-ref-btn"
              @click="openItemPicker(field.item_type, (id) => formData[field.key] = id)"
            >{{ itemRefLabel(formData[field.key]) }}</button>
            <button
              v-if="formData[field.key] != null"
              type="button"
              class="iem-item-ref-clear"
              @click="formData[field.key] = null"
            >×</button>
          </div>
        </template>

        <!-- int_by_suggest -->
        <template v-else-if="field.type === 'int_by_suggest'">
          <div class="iem-int-by-suggest">
            <input
              type="number"
              class="iem-input iem-int-by-suggest-input"
              :value="intBySuggestValue(field.key).value ?? ''"
              @input="setIntBySuggestField(field.key, 'value', numberOrNull($event.target.value))"
            />
            <select
              class="iem-select"
              :value="intBySuggestValue(field.key).suggest_id ?? ''"
              @change="setIntBySuggestField(field.key, 'suggest_id', numberOrNull($event.target.value))"
            >
              <option value="">—</option>
              <option v-for="s in getSuggests(field.suggest_type_id)" :key="s.id" :value="s.id">{{ s.value }}</option>
            </select>
          </div>
        </template>

        <!-- suggest (single) -->
        <template v-else-if="field.type === 'suggest'">
          <select class="iem-select" :value="formData[field.key] ?? ''" @change="formData[field.key] = numberOrNull($event.target.value)">
            <option value="">—</option>
            <option v-for="s in getSuggests(getSuggestId(field))" :key="s.id" :value="s.id">{{ s.value }}</option>
          </select>
        </template>

        <!-- suggest_array -->
        <template v-else-if="field.type === 'suggest_array'">
          <div class="iem-chip-row">
            <button
              v-for="id in (formData[field.key] || [])"
              :key="id"
              class="iem-chip"
              type="button"
              @click="removeArrayVal(field.key, id)"
            >{{ getSuggestLabel(getSuggestId(field), id) }} ×</button>
            <select class="iem-select iem-select-sm" value="" @change="addArrayVal(field.key, $event)">
              <option value="">+ Добавить</option>
              <option v-for="s in availableSuggests(field)" :key="s.id" :value="s.id">{{ s.value }}</option>
            </select>
          </div>
        </template>

        <!-- object -->
        <template v-else-if="field.type === 'object'">
          <div
            v-show="isSectionOpen(field.key)"
            class="iem-object iem-card-body"
            :class="{ 'iem-object--horizontal': field.layout === 'horizontal' }"
          >
            <template v-for="sub in (field.fields || [])" :key="sub.key">
              <div v-if="isNestedFieldVisible(field.key, sub)" class="iem-sub-field">
                <span v-if="!isBoolField(sub)" class="iem-sub-label">{{ sub.name }}</span>

                <template v-if="sub.type === 'description'">
                  <textarea
                    class="iem-textarea"
                    :value="objectValue(field.key)[sub.key] || ''"
                    @input="setObjectField(field.key, sub.key, $event.target.value)"
                  ></textarea>
                </template>

                <template v-else-if="isBoolField(sub)">
                  <button
                    class="iem-toggle"
                    :class="{ 'iem-toggle-on': !!objectValue(field.key)[sub.key] }"
                    type="button"
                    role="switch"
                    :aria-checked="!!objectValue(field.key)[sub.key]"
                    @click="setObjectField(field.key, sub.key, !objectValue(field.key)[sub.key])"
                  >
                    <span class="iem-toggle-track"><span class="iem-toggle-thumb"></span></span>
                    <span>{{ sub.name }}</span>
                  </button>
                </template>

                <template v-else-if="sub.type === 'int'">
                  <input
                    type="number"
                    class="iem-input iem-input-sm"
                    :value="objectValue(field.key)[sub.key] ?? ''"
                    @input="setObjectField(field.key, sub.key, numberOrNull($event.target.value))"
                  />
                </template>

                <template v-else-if="sub.type === 'item'">
                  <div class="iem-item-ref">
                    <button
                      type="button"
                      class="iem-item-ref-btn"
                      @click="openItemPicker(sub.item_type, (id) => setObjectField(field.key, sub.key, id))"
                    >{{ itemRefLabel(objectValue(field.key)[sub.key]) }}</button>
                    <button
                      v-if="objectValue(field.key)[sub.key] != null"
                      type="button"
                      class="iem-item-ref-clear"
                      @click="setObjectField(field.key, sub.key, null)"
                    >×</button>
                  </div>
                </template>

                <template v-else-if="sub.type === 'suggest'">
                  <select
                    class="iem-select"
                    :value="objectValue(field.key)[sub.key] ?? ''"
                    @change="setObjectField(field.key, sub.key, numberOrNull($event.target.value))"
                  >
                    <option value="">—</option>
                    <option v-for="s in getSuggests(getSuggestId(sub))" :key="s.id" :value="s.id">{{ s.value }}</option>
                  </select>
                </template>

                <template v-else-if="sub.type === 'suggest_array'">
                  <div class="iem-chip-row">
                    <button
                      v-for="id in (objectValue(field.key)[sub.key] || [])"
                      :key="id"
                      class="iem-chip"
                      type="button"
                      @click="removeNestedArrayVal(field.key, sub.key, id)"
                    >{{ getSuggestLabel(getSuggestId(sub), id) }} ×</button>
                    <select
                      class="iem-select iem-select-sm"
                      value=""
                      @change="addNestedArrayVal(field.key, sub.key, $event)"
                    >
                      <option value="">+ Добавить</option>
                      <option v-for="s in availableNestedSuggests(field.key, sub)" :key="s.id" :value="s.id">{{ s.value }}</option>
                    </select>
                  </div>
                </template>

                <template v-else-if="sub.type === 'object_array'">
                  <div class="iem-object-array iem-object-array-nested">
                    <div
                      v-for="(row, rowIdx) in nestedObjectArrayValue(field.key, sub.key)"
                      :key="rowIdx"
                      class="iem-object-row"
                    >
                      <div class="iem-object-row-fields">
                        <template v-for="nested in (sub.fields || [])" :key="nested.key">
                          <div v-if="isObjectArrayFieldVisible(sub, row, nested)" class="iem-sub-field">
                            <span v-if="!isBoolField(nested)" class="iem-sub-label">{{ nested.name }}</span>

                            <textarea
                              v-if="nested.type === 'description'"
                              class="iem-textarea"
                              :value="row[nested.key] || ''"
                              @input="setNestedObjectArrayField(field.key, sub.key, rowIdx, nested.key, $event.target.value)"
                            ></textarea>

                            <button
                              v-else-if="isBoolField(nested)"
                              class="iem-toggle"
                              :class="{ 'iem-toggle-on': !!row[nested.key] }"
                              type="button"
                              role="switch"
                              :aria-checked="!!row[nested.key]"
                              @click="setNestedObjectArrayField(field.key, sub.key, rowIdx, nested.key, !row[nested.key])"
                            >
                              <span class="iem-toggle-track"><span class="iem-toggle-thumb"></span></span>
                              <span>{{ nested.name }}</span>
                            </button>

                            <input
                              v-else-if="nested.type === 'int'"
                              type="number"
                              class="iem-input iem-input-sm"
                              :value="row[nested.key] ?? ''"
                              @input="setNestedObjectArrayField(field.key, sub.key, rowIdx, nested.key, numberOrNull($event.target.value))"
                            />

                            <div v-else-if="nested.type === 'item'" class="iem-item-ref">
                              <button
                                type="button"
                                class="iem-item-ref-btn"
                                @click="openItemPicker(nested.item_type, (id) => setNestedObjectArrayField(field.key, sub.key, rowIdx, nested.key, id))"
                              >{{ itemRefLabel(row[nested.key]) }}</button>
                              <button
                                v-if="row[nested.key] != null"
                                type="button"
                                class="iem-item-ref-clear"
                                @click="setNestedObjectArrayField(field.key, sub.key, rowIdx, nested.key, null)"
                              >×</button>
                            </div>

                            <select
                              v-else-if="nested.type === 'suggest'"
                              class="iem-select"
                              :value="row[nested.key] ?? ''"
                              @change="setNestedObjectArrayField(field.key, sub.key, rowIdx, nested.key, numberOrNull($event.target.value))"
                            >
                              <option value="">вЂ”</option>
                              <option v-for="s in getSuggests(getSuggestId(nested))" :key="s.id" :value="s.id">{{ s.value }}</option>
                            </select>

                            <input
                              v-else
                              type="text"
                              class="iem-input iem-input-sm"
                              :value="row[nested.key] ?? ''"
                              @input="setNestedObjectArrayField(field.key, sub.key, rowIdx, nested.key, $event.target.value)"
                            />
                          </div>
                        </template>
                      </div>
                      <button class="iem-row-remove" type="button" @click="removeNestedObjectArrayRow(field.key, sub.key, rowIdx)">РЈРґР°Р»РёС‚СЊ</button>
                    </div>

                    <button class="iem-row-add" type="button" @click="addNestedObjectArrayRow(field.key, sub)">+ Р”РѕР±Р°РІРёС‚СЊ</button>
                  </div>
                </template>

                <template v-else>
                  <input
                    type="text"
                    class="iem-input iem-input-sm"
                    :value="objectValue(field.key)[sub.key] ?? ''"
                    @input="setObjectField(field.key, sub.key, $event.target.value)"
                  />
                </template>
              </div>
            </template>
          </div>
        </template>

        <!-- object_array -->
        <template v-else-if="field.type === 'object_array'">
          <div v-show="isSectionOpen(field.key)" class="iem-object-array iem-card-body">
            <div
              v-for="(row, rowIdx) in objectArrayValue(field.key)"
              :key="rowIdx"
              class="iem-object-row"
            >
              <div class="iem-object-row-fields">
                <template v-for="sub in (field.fields || [])" :key="sub.key">
                  <div v-if="isObjectArrayFieldVisible(field, row, sub)" class="iem-sub-field">
                    <span v-if="!isBoolField(sub)" class="iem-sub-label">{{ sub.name }}</span>

                    <textarea
                      v-if="sub.type === 'description'"
                      class="iem-textarea"
                      :value="row[sub.key] || ''"
                      @input="setObjectArrayField(field.key, rowIdx, sub.key, $event.target.value)"
                    ></textarea>

                    <button
                      v-else-if="isBoolField(sub)"
                      class="iem-toggle"
                      :class="{ 'iem-toggle-on': !!row[sub.key] }"
                      type="button"
                      role="switch"
                      :aria-checked="!!row[sub.key]"
                      @click="setObjectArrayField(field.key, rowIdx, sub.key, !row[sub.key])"
                    >
                      <span class="iem-toggle-track"><span class="iem-toggle-thumb"></span></span>
                      <span>{{ sub.name }}</span>
                    </button>

                    <input
                      v-else-if="sub.type === 'int'"
                      type="number"
                      class="iem-input iem-input-sm"
                      :value="row[sub.key] ?? ''"
                      @input="setObjectArrayField(field.key, rowIdx, sub.key, numberOrNull($event.target.value))"
                    />

                    <div v-else-if="sub.type === 'item'" class="iem-item-ref">
                      <button
                        type="button"
                        class="iem-item-ref-btn"
                        @click="openItemPicker(sub.item_type, (id) => setObjectArrayField(field.key, rowIdx, sub.key, id))"
                      >{{ itemRefLabel(row[sub.key]) }}</button>
                      <button
                        v-if="row[sub.key] != null"
                        type="button"
                        class="iem-item-ref-clear"
                        @click="setObjectArrayField(field.key, rowIdx, sub.key, null)"
                      >×</button>
                    </div>

                    <select
                      v-else-if="sub.type === 'suggest'"
                      class="iem-select"
                      :value="row[sub.key] ?? ''"
                      @change="setObjectArrayField(field.key, rowIdx, sub.key, numberOrNull($event.target.value))"
                    >
                      <option value="">—</option>
                      <option v-for="s in getSuggests(getSuggestId(sub))" :key="s.id" :value="s.id">{{ s.value }}</option>
                    </select>

                    <input
                      v-else
                      type="text"
                      class="iem-input iem-input-sm"
                      :value="row[sub.key] ?? ''"
                      @input="setObjectArrayField(field.key, rowIdx, sub.key, $event.target.value)"
                    />
                  </div>
                </template>
              </div>
              <button class="iem-row-remove" type="button" @click="removeObjectArrayRow(field.key, rowIdx)">Удалить</button>
            </div>

            <button class="iem-row-add" type="button" @click="addObjectArrayRow(field)">+ Добавить</button>
          </div>
        </template>

        <!-- blocks (named description blocks: feats/actions/reactions) -->
        <template v-else-if="field.type === 'blocks'">
          <div v-show="isSectionOpen(field.key)" class="iem-blocks iem-card-body">
            <div
              v-for="(b, bIdx) in blocksValue(field.key)"
              :key="bIdx"
              class="iem-block-tile"
            >
              <input
                class="iem-input iem-block-name"
                :value="b.name"
                placeholder="Название блока..."
                @input="setBlockField(field.key, bIdx, 'name', $event.target.value)"
              />
              <InputDescription
                class="iem-description"
                :block="{ id: `${field.key}-${bIdx}`, content: { placeholder: 'Описание...' } }"
                :value="b.value || ''"
                @update:value="(_, value) => setBlockField(field.key, bIdx, 'value', value)"
              />
              <div class="iem-block-actions">
                <button
                  class="iem-block-move"
                  type="button"
                  :disabled="bIdx === 0"
                  @click="moveBlock(field.key, bIdx, -1)"
                >↑</button>
                <button
                  class="iem-block-move"
                  type="button"
                  :disabled="bIdx === blocksValue(field.key).length - 1"
                  @click="moveBlock(field.key, bIdx, 1)"
                >↓</button>
                <button
                  class="iem-block-remove"
                  type="button"
                  @click="removeBlock(field.key, bIdx)"
                >Удалить</button>
              </div>
            </div>
            <button class="iem-row-add" type="button" @click="addBlock(field.key)">+ Добавить блок</button>
          </div>
        </template>

        <!-- text / fallback -->
        <template v-else>
          <input type="text" class="iem-input" v-model="formData[field.key]" />
        </template>
      </div>
    </template>
    </div>

    <div class="iem-actions">
      <button class="iem-cancel" @click="$emit('close')">Отмена</button>
      <button class="iem-submit" :disabled="!formName.trim() || saving" @click="submit">
        {{ saving ? '...' : (item ? 'Сохранить' : 'Создать') }}
      </button>
    </div>

    <ItemPickerModal
      v-if="picker.open"
      :item-type-ids="[picker.typeId]"
      title="Выбрать предмет"
      @pick="onItemPicked"
      @close="picker.open = false"
    />
  </AppModal>
</template>

<script setup>
import { nextTick, onMounted, reactive, ref } from 'vue'
import AppModal from '@/shared/ui/AppModal'
import ColorPresetPicker from '@/shared/ui/ColorPresetPicker'
import InputDescription from '@/shared/ui/InputDescription'
import ItemPickerModal from '@/features/character-editor/components/ItemPickerModal'
import { fetchPost, fetchPut } from '@/shared/api/http'
import { useItemTypesStore } from '@/stores/itemTypes'
import { useSuggestStore } from '@/stores/suggest'
import { ensureItemNames, itemName } from '@/features/handbook/objects/lib/itemNames'
import {
  cloneDefault,
  collectSuggestIds as schemaCollectSuggestIds,
  defaultDataForFields,
  getSuggestId,
  isBooleanField,
  isFieldVisible as schemaIsFieldVisible,
  normalizeDataForSave,
  numberOrNull,
} from '@/features/handbook/objects/lib/schemaFields'

const props = defineProps({
  typeId:      { type: Number, required: true },
  item:        { type: Object, default: null },
  initialName: { type: String, default: '' },
  initialNameEn: { type: String, default: '' },
  showNameEn: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'saved'])

const suggestStore = useSuggestStore()
const itemTypesStore = useItemTypesStore()
const nameInput = ref(null)
const typeFields = ref([])
const formName = ref(props.initialName)
const formNameEn = ref(props.initialNameEn)
const formData = reactive({})
const saving = ref(false)
const sectionsOpen = reactive({})
const picker = reactive({ open: false, typeId: null, onPick: null })

const FULL_WIDTH_TYPES = new Set(['description', 'suggest_array', 'int_by_suggest', 'object', 'object_array', 'blocks'])
const CARD_TYPES = new Set(['object', 'object_array', 'blocks'])
function isCardField(field) {
  return CARD_TYPES.has(field.type)
}

function fieldClasses(field) {
  return {
    'iem-field--full': FULL_WIDTH_TYPES.has(field.type),
    'iem-field--card': isCardField(field),
  }
}

function defaultSectionOpen(field) {
  if (field.type === 'blocks') return false
  return true
}

function isSectionOpen(key) {
  return sectionsOpen[key] !== false
}

function toggleSection(key) {
  sectionsOpen[key] = !isSectionOpen(key)
}

function initSections(fields) {
  for (const f of fields || []) {
    if (CARD_TYPES.has(f.type)) {
      if (sectionsOpen[f.key] === undefined) {
        sectionsOpen[f.key] = defaultSectionOpen(f)
      }
    }
  }
}

onMounted(async () => {
  const type = await itemTypesStore.ensureType(props.typeId)
  typeFields.value = type?.fields || []

  for (const id of collectSuggestIds(typeFields.value)) {
    suggestStore.ensure(id)
  }

  if (props.item) {
    formName.value = props.item.name || ''
    formNameEn.value = props.item.nameEn || ''
    Object.assign(formData, JSON.parse(JSON.stringify(props.item.data || {})))
  } else {
    Object.assign(formData, defaultDataForFields(typeFields.value))
    formName.value = props.initialName
    formNameEn.value = props.initialNameEn
  }
  ensureContainerFields(typeFields.value)
  initSections(typeFields.value)
  ensureItemNames(collectItemRefIds(typeFields.value, formData))

  await nextTick()
  nameInput.value?.focus()
})

function isFieldVisible(field) {
  return schemaIsFieldVisible(field, formData)
}

function isNestedFieldVisible(parentKey, field) {
  return schemaIsFieldVisible(field, objectValue(parentKey))
}

function isObjectArrayFieldVisible(parentField, row, field) {
  return schemaIsFieldVisible(field, row || {})
}

function isBoolField(field) { return isBooleanField(field) }

function collectSuggestIds(fields) {
  return schemaCollectSuggestIds(fields)
}

function intBySuggestValue(key) {
  const current = formData[key]
  if (current && typeof current === 'object' && !Array.isArray(current)) return current
  if (typeof current === 'number') {
    formData[key] = { value: current, suggest_id: null }
  } else {
    formData[key] = { value: null, suggest_id: null }
  }
  return formData[key]
}

function setIntBySuggestField(key, subKey, value) {
  const current = intBySuggestValue(key)
  formData[key] = { ...current, [subKey]: value }
}

function getSuggests(suggestId) {
  return suggestStore.items(suggestId) || []
}

function getSuggestLabel(suggestId, id) {
  return getSuggests(suggestId).find(s => s.id === id)?.value || String(id)
}

function itemRefLabel(id) {
  if (id == null) return 'Выбрать предмет'
  return itemName(id) || ('#' + id)
}

function openItemPicker(typeId, onPick) {
  picker.typeId = typeId
  picker.onPick = onPick
  picker.open = true
}

function onItemPicked(item) {
  if (picker.onPick) picker.onPick(item.id)
  ensureItemNames([item.id])
  picker.open = false
}

function collectItemRefIds(fields, data) {
  const ids = []
  for (const field of fields || []) {
    const value = data?.[field.key]
    if (field.type === 'item') {
      if (value != null) ids.push(value)
    } else if (field.type === 'object' && value) {
      ids.push(...collectItemRefIds(field.fields, value))
    } else if (field.type === 'object_array' && Array.isArray(value)) {
      for (const row of value) ids.push(...collectItemRefIds(field.fields, row))
    }
  }
  return ids
}

function availableSuggests(field) {
  const selected = formData[field.key] || []
  return getSuggests(getSuggestId(field)).filter(s => !selected.includes(s.id))
}

function availableNestedSuggests(parentKey, field) {
  const selected = (objectValue(parentKey) || {})[field.key] || []
  return getSuggests(getSuggestId(field)).filter(s => !selected.includes(s.id))
}

function addArrayVal(key, e) {
  const id = numberOrNull(e.target.value)
  e.target.value = ''
  if (id == null) return
  if (!(formData[key] || []).includes(id)) formData[key] = [...(formData[key] || []), id]
}

function removeArrayVal(key, id) {
  formData[key] = (formData[key] || []).filter(v => v !== id)
}

function addNestedArrayVal(parentKey, subKey, e) {
  const id = numberOrNull(e.target.value)
  e.target.value = ''
  if (id == null) return
  const obj = objectValue(parentKey)
  const cur = Array.isArray(obj[subKey]) ? obj[subKey] : []
  if (cur.includes(id)) return
  setObjectField(parentKey, subKey, [...cur, id])
}

function removeNestedArrayVal(parentKey, subKey, id) {
  const obj = objectValue(parentKey)
  const cur = Array.isArray(obj[subKey]) ? obj[subKey] : []
  setObjectField(parentKey, subKey, cur.filter(v => v !== id))
}

function ensureContainerFields(fields) {
  for (const field of fields || []) {
    if (field.type === 'object' && !formData[field.key]) {
      formData[field.key] = defaultDataForObject(field)
    } else if (field.type === 'object_array' && !Array.isArray(formData[field.key])) {
      formData[field.key] = []
    } else if (field.type === 'suggest_array' && !Array.isArray(formData[field.key])) {
      formData[field.key] = []
    }
  }
}

function defaultDataForObject(field) {
  const data = defaultDataForFields(field.fields || [])
  for (const sub of field.fields || []) {
    if (sub.type === 'object' && !data[sub.key]) data[sub.key] = defaultDataForObject(sub)
    if (sub.type === 'object_array' && !Array.isArray(data[sub.key])) data[sub.key] = []
    if (sub.type === 'suggest_array' && !Array.isArray(data[sub.key])) data[sub.key] = []
  }
  return data
}

function objectValue(key) {
  if (!formData[key] || typeof formData[key] !== 'object' || Array.isArray(formData[key])) {
    formData[key] = {}
  }
  return formData[key]
}

function setObjectField(objKey, subKey, value) {
  formData[objKey] = { ...objectValue(objKey), [subKey]: value }
}

function nestedObjectArrayValue(objKey, arrayKey) {
  const obj = objectValue(objKey)
  if (!Array.isArray(obj[arrayKey])) {
    formData[objKey] = { ...obj, [arrayKey]: [] }
  }
  return formData[objKey][arrayKey]
}

function objectArrayValue(key) {
  if (!Array.isArray(formData[key])) formData[key] = []
  return formData[key]
}

function emptyObjectArrayRow(field) {
  const row = {}
  for (const sub of field.fields || []) {
    if (Object.prototype.hasOwnProperty.call(sub, 'default')) row[sub.key] = cloneDefault(sub.default)
    else if (isBooleanField(sub)) row[sub.key] = false
    else if (sub.type === 'int' || sub.type === 'suggest' || sub.type === 'item') row[sub.key] = null
    else if (sub.type === 'suggest_array' || sub.type === 'object_array') row[sub.key] = []
    else if (sub.type === 'object') row[sub.key] = defaultDataForObject(sub)
    else row[sub.key] = ''
  }
  return row
}

function addObjectArrayRow(field) {
  formData[field.key] = [...objectArrayValue(field.key), emptyObjectArrayRow(field)]
}

function removeObjectArrayRow(key, rowIdx) {
  formData[key] = objectArrayValue(key).filter((_, idx) => idx !== rowIdx)
}

function setObjectArrayField(key, rowIdx, subKey, value) {
  formData[key] = objectArrayValue(key).map((row, idx) =>
    idx === rowIdx ? { ...row, [subKey]: value } : row
  )
}

function addNestedObjectArrayRow(objKey, field) {
  const rows = nestedObjectArrayValue(objKey, field.key)
  setObjectField(objKey, field.key, [...rows, emptyObjectArrayRow(field)])
}

function removeNestedObjectArrayRow(objKey, arrayKey, rowIdx) {
  setObjectField(objKey, arrayKey, nestedObjectArrayValue(objKey, arrayKey).filter((_, idx) => idx !== rowIdx))
}

function setNestedObjectArrayField(objKey, arrayKey, rowIdx, subKey, value) {
  setObjectField(objKey, arrayKey, nestedObjectArrayValue(objKey, arrayKey).map((row, idx) =>
    idx === rowIdx ? { ...row, [subKey]: value } : row
  ))
}

function blocksValue(key) {
  if (!Array.isArray(formData[key])) formData[key] = []
  return formData[key]
}

function addBlock(key) {
  formData[key] = [...blocksValue(key), { name: '', value: '' }]
}

function removeBlock(key, idx) {
  formData[key] = blocksValue(key).filter((_, i) => i !== idx)
}

function setBlockField(key, idx, subKey, value) {
  formData[key] = blocksValue(key).map((b, i) =>
    i === idx ? { ...b, [subKey]: value } : b
  )
}

function moveBlock(key, idx, delta) {
  const list = [...blocksValue(key)]
  const target = idx + delta
  if (target < 0 || target >= list.length) return
  const [item] = list.splice(idx, 1)
  list.splice(target, 0, item)
  formData[key] = list
}

async function submit() {
  if (!formName.value.trim() || saving.value) return
  saving.value = true
  try {
    const data = normalizeDataForSave({ ...formData }, typeFields.value)
    let saved
    const payload = {
      name: formName.value.trim(),
      data,
    }
    if (props.showNameEn) payload.nameEn = formNameEn.value.trim() || null
    if (props.item) {
      await fetchPut('/items/' + props.item.id, payload)
      saved = { ...props.item, ...payload }
    } else {
      saved = await fetchPost('/items', { typeId: props.typeId, ...payload })
      if (props.showNameEn) saved = { ...saved, nameEn: payload.nameEn }
    }
    emit('saved', saved)
    emit('close')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.iem-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  padding-right: 24px;
}

.iem-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  align-items: start;
}

@media (max-width: 720px) {
  .iem-fields-grid { grid-template-columns: 1fr; }
}

.iem-field--full {
  grid-column: 1 / -1;
}

.iem-field--card {
  padding: 0;
  border: 1px solid var(--border, rgba(140, 140, 154, 0.25));
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  gap: 0;
  overflow: hidden;
}

.iem-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: none;
  font-family: inherit;
  color: var(--text-1);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}
.iem-card-head:hover { background: rgba(255, 255, 255, 0.04); }

.iem-card-head-name {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-1);
}

.iem-card-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform 0.18s;
}
.iem-card-head--open .iem-card-chevron {
  transform: rotate(180deg);
  color: var(--accent, #a292ff);
}

.iem-card-body {
  padding: 12px 14px 14px;
  border-top: 1px solid var(--border, rgba(140, 140, 154, 0.2));
}

.iem-object--horizontal {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px;
}
.iem-object--horizontal .iem-sub-field {
  flex: none;
  min-width: 0;
}

/* Blocks editor */
.iem-blocks {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.iem-block-tile {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border, rgba(140, 140, 154, 0.25));
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.025);
}
.iem-block-name {
  font-weight: 600;
}
.iem-block-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}
.iem-block-move,
.iem-block-remove {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: var(--text-2);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 3px 10px;
}
.iem-block-move:disabled { opacity: 0.3; cursor: not-allowed; }
.iem-block-remove { color: #e05c5c; border-color: rgba(224, 92, 92, 0.3); }
.iem-block-remove:hover { background: rgba(224, 92, 92, 0.15); }
.iem-block-move:not(:disabled):hover { background: rgba(255, 255, 255, 0.1); color: var(--text-1); }

.iem-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.iem-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.iem-input {
  width: 100%;
  box-sizing: border-box;
  height: 38px;
  background: #141418;
  border: 1px solid rgba(140, 140, 154, 0.35);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  padding: 0 11px;
  outline: none;
}
.iem-input:focus { border-color: rgba(126, 118, 255, 0.7); }
.iem-input-sm { height: 32px; font-size: 13px; }

.iem-textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 72px;
  resize: vertical;
  background: #141418;
  border: 1px solid rgba(140, 140, 154, 0.35);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  line-height: 1.45;
  padding: 8px 10px;
  outline: none;
}
.iem-textarea:focus { border-color: rgba(126, 118, 255, 0.7); }

.iem-select {
  background: #141418;
  border: 1px solid rgba(140, 140, 154, 0.35);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  padding: 6px 10px;
  outline: none;
  cursor: pointer;
}
.iem-select:focus { border-color: rgba(126, 118, 255, 0.7); }
.iem-select-sm { align-self: flex-start; }

.iem-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 13px;
  color: var(--text-2);
  font-family: inherit;
  cursor: pointer;
  text-align: left;
}

.iem-toggle-track {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  background: #27272f;
  border: 1px solid rgba(140, 140, 154, 0.35);
  transition: background 0.14s, border-color 0.14s;
  flex-shrink: 0;
}

.iem-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: transform 0.14s, background 0.14s;
}

.iem-toggle-on {
  color: var(--text-1);
}

.iem-toggle-on .iem-toggle-track {
  background: rgba(122, 106, 255, 0.25);
  border-color: rgba(122, 106, 255, 0.65);
}

.iem-toggle-on .iem-toggle-thumb {
  background: #b0a4ff;
  transform: translateX(16px);
}

.iem-int-by-suggest {
  display: flex;
  gap: 6px;
  align-items: center;
}
.iem-int-by-suggest-input { width: 120px; }

.iem-item-ref {
  display: flex;
  align-items: center;
  gap: 6px;
}

.iem-item-ref-btn {
  flex: 1;
  min-width: 0;
  text-align: left;
  height: 38px;
  background: #141418;
  border: 1px solid rgba(140, 140, 154, 0.35);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  padding: 0 11px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: border-color 0.12s;
}
.iem-item-ref-btn:hover { border-color: rgba(126, 118, 255, 0.7); }

.iem-item-ref-clear {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: 1px solid rgba(140, 140, 154, 0.35);
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 16px;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
}
.iem-item-ref-clear:hover { color: #e08080; border-color: rgba(224, 85, 85, 0.45); }

.iem-chip-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.iem-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(162, 146, 255, 0.3);
  border-radius: 6px;
  background: rgba(162, 146, 255, 0.08);
  color: #b0a4ff;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.iem-chip:hover { border-color: rgba(224, 85, 85, 0.5); background: rgba(224, 85, 85, 0.08); color: #e08080; }

.iem-object,
.iem-object-array {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.iem-object {
  padding: 12px;
  border: 1px solid rgba(91, 101, 126, 0.38);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
}

.iem-sub-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.iem-sub-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
}

.iem-object-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(140, 140, 154, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.025);
}

.iem-object-row-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}

.iem-object-array-nested {
  gap: 6px;
}

.iem-object-array-nested .iem-object-row {
  padding: 8px;
}

.iem-row-add,
.iem-row-remove {
  align-self: flex-start;
  border: 1px dashed rgba(140, 140, 154, 0.35);
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  padding: 6px 10px;
  cursor: pointer;
}
.iem-row-add:hover { color: #c9c4ff; border-color: rgba(122, 106, 255, 0.55); }
.iem-row-remove:hover { color: #e08080; border-color: rgba(224, 85, 85, 0.45); }

.iem-description :deep(.desc-editor) {
  min-height: 130px;
  max-height: 280px;
  overflow-y: auto;
}

.iem-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

.iem-cancel {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: color 0.12s;
}
.iem-cancel:hover { color: var(--text-2); }

.iem-submit {
  background: rgba(122, 106, 255, 0.18);
  border: 1px solid rgba(122, 106, 255, 0.4);
  border-radius: 8px;
  color: #a89eff;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 20px;
  cursor: pointer;
  transition: background 0.12s, opacity 0.12s;
}
.iem-submit:hover:not(:disabled) { background: rgba(122, 106, 255, 0.28); }
.iem-submit:disabled { opacity: 0.35; cursor: not-allowed; }
</style>
