<template>
  <AppModalFrame wide :title="item ? 'Редактировать предмет' : (typeName ? `Новый элемент в «${typeName}»` : 'Новый элемент')" :z-index="4500" @close="$emit('close')">

    <FormField label="Название" vertical>
      <FormTextInput
        ref="nameInput"
        v-model:value="formName"
        placeholder="Название..."
        @enter="submit"
      />
    </FormField>

    <FormField v-if="showNameEn" label="EN" vertical>
      <FormTextInput
        v-model:value="formNameEn"
        placeholder="English name..."
        @enter="submit"
      />
    </FormField>

    <FormField v-if="typeId === 5" label="Иконка" hint="PNG или WebP, до 5 МБ" vertical>
      <div class="iem-icon-editor">
        <div class="iem-icon-preview" :class="{ empty: !hasIconPreview }">
          <img v-if="iconPreviewUrl" :src="iconPreviewUrl" alt="" />
          <ItemIcon
            v-else-if="!iconRemoved && (item?.iconImageUrl || item?.svg)"
            :item="item"
            :fallback-to-type="false"
            :size="64"
          />
          <span v-else>Нет иконки</span>
        </div>
        <div class="iem-icon-actions">
          <button type="button" class="iem-icon-button" @click="iconFileInput?.click()">
            {{ hasIconPreview ? 'Заменить' : 'Выбрать файл' }}
          </button>
          <button v-if="hasIconPreview" type="button" class="iem-icon-button danger" @click="removeIcon">
            Удалить
          </button>
        </div>
        <input
          ref="iconFileInput"
          type="file"
          accept="image/png,image/webp,.png,.webp"
          hidden
          @change="onIconFileChange"
        />
      </div>
    </FormField>

    <div v-if="contentSources.length" class="iem-field iem-source-field">
      <label class="iem-label">Источники</label>
      <div class="iem-source-list">
        <button
          v-for="source in contentSources"
          :key="source.id"
          type="button"
          class="iem-source"
          :class="{ selected: contentSourceSelected(source.id) }"
          :title="source.description || source.name"
          @click="toggleContentSource(source.id)"
        >
          <span class="iem-source-mark">{{ contentSourceSelected(source.id) ? '✓' : '' }}</span>
          <span>{{ source.name }}</span>
          <small>{{ source.code }}</small>
        </button>
      </div>
    </div>

    <div class="iem-fields-grid">
      <ItemSchemaField v-for="field in typeFields" :key="field.key" :field="field" />
    </div>

    <ItemPickerModal
      v-if="picker.open"
      :item-type-ids="[picker.typeId]"
      title="Выбрать предмет"
      @pick="onItemPicked"
      @close="picker.open = false"
    />
    <template #footer>
      <div class="iem-actions">
        <button class="iem-cancel" @click="$emit('close')">Отмена</button>
        <button class="iem-submit" :disabled="!formName.trim() || saving" @click="submit">
          {{ saving ? '...' : (item ? 'Сохранить' : 'Создать') }}
        </button>
      </div>
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref } from 'vue'
import AppModalFrame from '@/shared/ui/AppModalFrame.vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemSchemaField from './ItemSchemaField.vue'
import { FormField } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { fetchPost, fetchPut } from '@/shared/api/http'
import { itemsApi } from '@/shared/api/itemsApi'
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
const typeFields = ref([])
const contentSources = ref([])
const selectedContentSourceIds = ref([])
const formName = ref(props.initialName)
const formNameEn = ref(props.initialNameEn)
const formData = reactive({})
const saving = ref(false)
const picker = reactive({ open: false, typeId: null, onPick: null })
const iconFileInput = ref(null)
const iconFile = ref(null)
const iconPreviewUrl = ref('')
const iconRemoved = ref(false)
const hasIconPreview = computed(() => !!iconPreviewUrl.value || (!iconRemoved.value && !!(props.item?.iconImageUrl || props.item?.svg)))
const fieldEditor = useItemFieldEditor(formData, openItemPicker)
provide(itemFieldEditorKey, fieldEditor)

onBeforeUnmount(revokeIconPreview)

onMounted(async () => {
  const type = await itemTypesStore.ensureType(props.typeId)
  typeFields.value = type?.fields || []
  if (type?.sourceId != null) {
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
    Object.assign(formData, defaultDataForFields(typeFields.value))
    formName.value = props.initialName
    formNameEn.value = props.initialNameEn
    selectedContentSourceIds.value = contentSources.value.filter((source) => source.isDefault).map((source) => source.id)
  }
  fieldEditor.ensureContainerFields(typeFields.value)
  fieldEditor.initSections(typeFields.value)
  fieldEditor.ensureItemNames(fieldEditor.collectItemRefIds(typeFields.value, formData))

  await nextTick()
  nameInput.value?.focus()
})

function contentSourceSelected(id) {
  return selectedContentSourceIds.value.some((value) => String(value) === String(id))
}

function toggleContentSource(id) {
  selectedContentSourceIds.value = contentSourceSelected(id)
    ? selectedContentSourceIds.value.filter((value) => String(value) !== String(id))
    : [...selectedContentSourceIds.value, id]
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

function revokeIconPreview() {
  if (iconPreviewUrl.value) URL.revokeObjectURL(iconPreviewUrl.value)
  iconPreviewUrl.value = ''
}

function onIconFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  revokeIconPreview()
  iconFile.value = file
  iconPreviewUrl.value = URL.createObjectURL(file)
  iconRemoved.value = false
  event.target.value = ''
}

function removeIcon() {
  revokeIconPreview()
  iconFile.value = null
  iconRemoved.value = true
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
      contentSourceIds: selectedContentSourceIds.value,
    }
    if (props.showNameEn) payload.nameEn = formNameEn.value.trim() || null
    if (props.item) {
      await fetchPut('/items/' + props.item.id, payload)
      saved = { ...props.item, ...payload }
    } else {
      saved = await fetchPost('/items', { typeId: props.typeId, ...payload })
      if (props.showNameEn) saved = { ...saved, nameEn: payload.nameEn }
    }
    if (props.typeId === 5 && iconFile.value) {
      const icon = await itemsApi.uploadIconImage(saved.id, iconFile.value)
      saved = { ...saved, iconSvgId: null, svg: null, ...icon }
    } else if (props.typeId === 5 && iconRemoved.value && props.item) {
      await itemsApi.clearIcon(saved.id)
      saved = { ...saved, iconSvgId: null, iconImageId: null, svg: null, iconImageUrl: null }
    }
    emit('saved', saved)
    emit('close')
  } finally {
    saving.value = false
  }
}
</script>

<style src="./styles/ItemEditModal.css"></style>
