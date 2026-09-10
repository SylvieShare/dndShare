<template>
  <AppModalFrame :body-scroll="!isAbility || narrow" wide :extra-wide="isAbility" :title="item ? (isAbility ? 'Редактировать способность' : 'Редактировать предмет') : (isAbility ? 'Новая способность' : typeName ? `Новый элемент в «${typeName}»` : 'Новый элемент')" :z-index="zIndex" @close="$emit('close')">

    <div v-if="loadError" role="alert"><p>{{ loadError }}</p><button type="button" class="ability-link" @click="loadForm">Повторить загрузку</button></div>
    <p v-else-if="!ready" class="iem-required-hint">Загрузка формы…</p>
    <component v-else :is="isAbility ? AbilityEditor : 'div'" v-bind="isAbility ? { fields: editableTypeFields, data: formData, typeId, zIndex } : {}">
      <FormField label="Название" title="Название способности или объекта в справочнике и на листе персонажа." vertical>
        <FormTextInput
          ref="nameInput"
          v-model:value="formName"
          placeholder="Название..."
          @enter="submit"
        />
      </FormField>

      <FormField v-if="showNameEn" label="Английское название" title="Необязательное оригинальное название для поиска." vertical>
        <FormTextInput
          v-model:value="formNameEn"
          placeholder="English name..."
          @enter="submit"
        />
      </FormField>

      <ItemMediaEditor :item="persistedItem || item" :media="media" :z-index="zIndex" />

      <ItemSourcePicker v-if="showPublicationSources && contentSources.length" v-model="selectedContentSourceIds" :sources="contentSources" :z-index="zIndex + 200" />
      <div v-if="!isAbility" class="iem-fields-grid">
        <ItemSchemaField v-for="field in editableTypeFields" :key="field.key" :field="field" />
      </div>
    </component>

    <ItemPickerModal
      v-if="picker.open"
      :item-type-ids="[picker.typeId]"
      :z-index="zIndex + 400"
      title="Выбрать предмет"
      @pick="onItemPicked"
      @close="picker.open = false"
    />
    <template #footer>
      <p v-for="(issue, index) in [...editorValidation.values()]" :key="index" role="alert" class="iem-required-hint">{{ issue }}</p>
      <p v-if="saveError" role="alert" class="iem-required-hint">{{ saveError }}</p>
      <div class="iem-actions">
        <span v-if="missingRequiredFields.length" class="iem-required-hint">Заполните обязательные поля</span>
        <button class="iem-cancel" @click="$emit('close')">Отмена</button>
        <button class="iem-submit" :disabled="!canSubmit || saving" @click="submit">
          {{ saving ? '...' : (item ? 'Сохранить' : 'Создать') }}
        </button>
      </div>
    </template>
  </AppModalFrame>
</template>

<script setup>
import { canSelectItemPublication } from '@/features/items/lib/itemPermissions'
import AbilityEditor from '@/features/items/editor/AbilityEditor.vue'
import ItemSourcePicker from '@/features/items/editor/ItemSourcePicker.vue'
import { ABILITY_TYPE_IDS } from '@/shared/lib/abilityTypes'
import '@/features/items/editor/abilityEditor.css'
import { computed, nextTick, onMounted, provide, reactive, ref } from 'vue'
import { AppModalFrame, useMediaQuery } from '@sylvieshare/share-ui'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemSchemaField from './ItemSchemaField.vue'
import { FormField } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import ItemMediaEditor from '@/features/items/editor/ItemMediaEditor.vue'
import { useItemMedia } from '@/features/items/editor/useItemMedia'
import { fetchPost, fetchPut } from '@/shared/api/http'
import { contentSourcesApi } from '@/shared/api/contentSourcesApi'
import { useItemTypesStore } from '@/stores/itemTypes'
import { useSuggestStore } from '@/stores/suggest'
import {
  collectSuggestIds as schemaCollectSuggestIds,
  defaultDataForFields,
  normalizeDataForSave,
} from '@/features/handbook/objects/lib/schemaFields'
import { itemFieldEditorKey, useItemFieldEditor } from './useItemFieldEditor'

const props = defineProps({
  typeId:      { type: Number, required: true },
  zIndex: { type: Number, default: 4500 },
  typeName:    { type: String, default: '' },
  item:        { type: Object, default: null },
  initialName: { type: String, default: '' },
  initialNameEn: { type: String, default: '' },
  showNameEn: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'saved'])

const suggestStore = useSuggestStore()
const itemTypesStore = useItemTypesStore()
const nameInput = ref(null)
const ready = ref(false)
const loadError = ref('')
const saveError = ref('')
const isAbility = computed(() => ABILITY_TYPE_IDS.includes(props.typeId))
const typeFields = ref([])
const editableTypeFields = computed(() => typeFields.value.filter(field => !field.readonly))
const showPublicationSources = computed(() => canSelectItemPublication(props.item))
const contentSources = ref([])
const selectedContentSourceIds = ref([])
const formName = ref(props.initialName)
const formNameEn = ref(props.initialNameEn)
const formData = reactive({})
const saving = ref(false)
const missingRequiredFields = computed(() => editableTypeFields.value.filter((field) => {
  if (!field.required) return false
  const value = formData[field.key]
  if (field.type === 'item') return !(Number(value) > 0)
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'string') return !value.trim()
  return value == null
}))
const editorValidation = reactive(new Map())
const canSubmit = computed(() => ready.value && !!formName.value.trim() && missingRequiredFields.value.length === 0 && editorValidation.size === 0)
const picker = reactive({ open: false, typeId: null, onPick: null })
const narrow = useMediaQuery('(max-width: 760px)')
const persistedItem = ref(null)
const media = useItemMedia()
const fieldEditor = useItemFieldEditor(formData, openItemPicker)
Object.defineProperties(fieldEditor, {
  zIndex: { get: () => props.zIndex },
  itemId: { get: () => props.item?.id || 0 },
  itemData: { get: () => formData },
  itemName: { get: () => formName.value },
})
fieldEditor.setValidationError = (key, message) => message ? editorValidation.set(key, message) : editorValidation.delete(key)
provide(itemFieldEditorKey, fieldEditor)


onMounted(loadForm)

async function loadForm() {
  loadError.value = ''
  try {
    const type = await itemTypesStore.ensureType(props.typeId)
    if (!type) throw new Error('Справочник не найден')
    typeFields.value = type.fields || []
    if (showPublicationSources.value && type?.sourceId != null) {
      const sourceRes = await contentSourcesApi.listForSystem(type.sourceId)
      contentSources.value = sourceRes?.sources || []
    }

    for (const id of schemaCollectSuggestIds(typeFields.value)) {
      suggestStore.ensure(id)
    }

    if (props.item) {
      formName.value = props.item.name || ''
      formNameEn.value = props.item.nameEn || ''
      Object.assign(formData, JSON.parse(JSON.stringify(props.item.data || {})))
      selectedContentSourceIds.value = [...(props.item.contentSourceIds || [])]
    } else {
      Object.assign(formData, defaultDataForFields(isAbility.value ? typeFields.value.filter(field => field.key === 'level') : typeFields.value))
      formName.value = props.initialName
      formNameEn.value = props.initialNameEn
      selectedContentSourceIds.value = contentSources.value.filter((source) => source.isDefault).map((source) => source.id)
    }
    if (!isAbility.value) fieldEditor.ensureContainerFields(typeFields.value)
    fieldEditor.initSections(typeFields.value)
    fieldEditor.ensureItemNames(fieldEditor.collectItemRefIds(typeFields.value, formData))

    ready.value = true
    await nextTick()
    nameInput.value?.focus()
  } catch (error) {
    loadError.value = `Не удалось загрузить форму: ${error.message}`
  }
}

function openItemPicker(typeId, onPick) {
  picker.typeId = typeId
  picker.onPick = onPick
  picker.open = true
}

function onItemPicked(item) {
  if (picker.onPick) picker.onPick(item.id)
  fieldEditor.ensureItemNames([item.id])
  picker.open = false
}

async function submit() {
  if (!canSubmit.value || saving.value) return
  saving.value = true
  saveError.value = ''
  let contentSaved = false
  try {
    const data = normalizeDataForSave({ ...formData }, typeFields.value)
    let saved
    const payload = {
      name: formName.value.trim(),
      data,
    }
    if (showPublicationSources.value) payload.contentSourceIds = selectedContentSourceIds.value
    if (props.showNameEn) payload.nameEn = formNameEn.value.trim() || null
    if (persistedItem.value || props.item) {
      const current = persistedItem.value || props.item
      await fetchPut('/items/' + current.id, payload)
      saved = { ...current, ...payload }
    } else {
      saved = await fetchPost('/items', { typeId: props.typeId, ...payload })
      if (props.showNameEn) saved = { ...saved, nameEn: payload.nameEn }
    }
    persistedItem.value = saved
    contentSaved = true
    await media.save(persistedItem.value)
    saved = persistedItem.value
    itemTypesStore.reset()
    emit('saved', saved)
    emit('close')
  } catch (error) {
    saveError.value = contentSaved ? `Объект сохранён, но загрузка изображений не завершена: ${error.message}. Повторите сохранение.` : `Не удалось сохранить: ${error.message}`
  } finally {
    saving.value = false
  }
}
</script>

<style src="./styles/ItemEditModal.css"></style>
