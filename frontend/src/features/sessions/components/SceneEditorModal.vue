<template>
  <AppModalFrame extra-wide :title="scene ? 'Редактировать сценарий' : 'Новый сценарий'" @close="$emit('close')">
    <div class="scene-editor-main-grid">
      <FormField label="Название" vertical>
        <FormTextInput v-model:value="draft.name" :maxlength="160" placeholder="Название сценария" autofocus @enter="submit" />
      </FormField>
      <FormField label="Статус" vertical>
        <FormSelect v-model:value="draft.status">
          <option v-for="status in SCENE_STATUSES" :key="status.key" :value="status.key">{{ status.label }}</option>
        </FormSelect>
      </FormField>
      <FormField label="Локация" vertical>
        <div class="scene-location-field">
          <button type="button" class="scene-location-pick" @click="locationPickerOpen = true">
            {{ selectedLocationLabel || 'Выбрать локацию' }}
          </button>
          <RemoveButton v-if="draft.locationId" label="Убрать привязку к локации" @click="draft.locationId = 0" />
        </div>
        <UniversalRelationPickerModal
          v-if="locationPickerOpen"
          :items="locationOptions"
          fixed-type="location"
          @close="locationPickerOpen = false"
          @select="selectLocation"
        />
      </FormField>
    </div>

    <div class="scene-image-section">
      <div class="scene-image-title">Изображение</div>
      <SessionImagePicker
        :model-value="draft.imageId"
        :current-url="currentImageUrl"
        :empty-label="inheritedImageLabel"
        :empty-action-label="selectedLocation ? 'Взять из локации' : 'Убрать изображение'"
        allow-empty
        @select="draft.imageId = $event.id"
      />
    </div>

    <template #footer>
      <FormActionButtons
        :submit-text="scene ? 'Сохранить' : 'Создать сценарий'"
        loading-text="Сохранение…"
        :loading="saving"
        :can-submit="!!draft.name.trim() && (!!draft.imageId || !!draft.locationId)"
        @cancel="$emit('close')"
        @submit="submit"
      />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { AppModalFrame, RemoveButton } from '@sylvieshare/share-ui'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormSelect } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import UniversalRelationPickerModal from '@/features/sessions/components/UniversalRelationPickerModal.vue'
import { buildSessionEntityCatalog } from '@/features/sessions/lib/sessionEntityRelations'
import SessionImagePicker from '@/features/sessions/components/SessionImagePicker.vue'
import { SCENE_STATUSES } from '@/features/sessions/lib/chapterGraph'
import { locationBreadcrumb } from '@/features/sessions/lib/sessionWorld'

const props = defineProps({
  scene: { type: Object, default: null },
  saving: { type: Boolean, default: false },
  locations: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'save'])
const draft = reactive({
  name: props.scene?.name ?? '',
  status: props.scene?.status ?? 'none',
  locationId: props.scene?.locationId ?? 0,
  imageId: props.scene?.imageId ?? 0,
})
const locationsById = computed(() => new Map(props.locations.map(location => [location.id, location])))
const locationPickerOpen = ref(false)
const locationOptions = computed(() => buildSessionEntityCatalog({ locations: { value: props.locations } })
  .map(item => ({
    ...item,
    subtitle: locationBreadcrumb(locationsById.value.get(item.id), locationsById.value).map(location => location.name).join(' / '),
  }))
  .sort((left, right) => left.subtitle.localeCompare(right.subtitle, 'ru')))
const selectedLocation = computed(() => locationsById.value.get(Number(draft.locationId)) || null)
const selectedLocationLabel = computed(() => selectedLocation.value
  ? locationBreadcrumb(selectedLocation.value, locationsById.value).map(location => location.name).join(' / ')
  : '')
function selectLocation(item) {
  draft.locationId = Number(item.id)
  locationPickerOpen.value = false
}
const currentImageUrl = computed(() => {
  if (draft.imageId && Number(draft.imageId) === Number(props.scene?.imageId)) return props.scene?.imageUrl || ''
  return selectedLocation.value?.imageUrl || ''
})
const inheritedImageLabel = computed(() => selectedLocation.value
  ? `Из локации «${selectedLocation.value.name}»`
  : 'Не выбрано')

function submit() {
  if (!draft.name.trim() || (!draft.imageId && !draft.locationId) || props.saving) return
  emit('save', {
    name: draft.name.trim(),
    status: draft.status,
    locationId: draft.locationId ? Number(draft.locationId) : null,
    imageId: draft.imageId ? Number(draft.imageId) : null,
  })
}
</script>

<style scoped>
.scene-editor-main-grid { display: grid; grid-template-columns: minmax(0, 1fr) 190px minmax(220px, .8fr); gap: 14px; }
.scene-location-field { display: flex; align-items: center; gap: 8px; }
.scene-location-pick { flex: 1; min-width: 0; padding: 9px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-raised); color: var(--text-1); font: inherit; text-align: left; cursor: pointer; }
.scene-location-pick:hover { border-color: var(--accent); }
.scene-image-section { display: flex; flex-direction: column; gap: 10px; }
.scene-image-title { color: var(--text-2); font-size: 13px; font-weight: 600; }
@media (max-width: 820px) { .scene-editor-main-grid { grid-template-columns: 1fr; } }
</style>
