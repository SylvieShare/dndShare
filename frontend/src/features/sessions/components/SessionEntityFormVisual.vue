<template>
  <button v-if="visualField && props.editable" type="button" class="entity-visual-button" :disabled="props.saving || busy" :title="visualField.input === 'video' ? 'Сменить видео' : 'Сменить изображение'" :aria-label="visualField.input === 'video' ? 'Сменить видео' : 'Сменить изображение'" @click="open">
    <img v-if="imageUrl" :src="imageUrl" alt="" :style="position" />
    <component :is="icon" v-else :size="32" />
  </button>
  <span v-else class="entity-visual-button">
    <img v-if="imageUrl" :src="imageUrl" alt="" :style="position" />
    <component :is="icon" v-else :size="32" />
  </span>
  <AppModalFrame v-if="opened" :title="visualField.label" @close="opened = false">
    <SessionEntityAssetInput :model-value="value" :catalog="visualField.catalog || 'story'" :video="visualField.input === 'video'" :allow-upload="!!visualField.allowUpload" @update:model-value="value = $event" @busy="uploading = $event" />
    <p v-if="error" role="alert">{{ error }}</p>
    <template #footer><FormActionButtons submit-text="Выбрать" :loading="uploading || busy || props.saving" :can-submit="!!value?.id" @cancel="opened = false" @submit="save" /></template>
  </AppModalFrame>
</template>
<script setup>
import { computed, ref } from 'vue'
import { Image, ScrollText, UserRound, MapPin } from '@lucide/vue'
import { AppModalFrame, FormActionButtons } from '@sylvieshare/share-ui'
import SessionEntityAssetInput from './SessionEntityAssetInput.vue'
import { useSessionEntityForm } from '../lib/sessionEntityFormContext'
import { materialType } from '../lib/sessionMaterials'
const { props, draft, busy, uploading, visualField, saveField, updateField } = useSessionEntityForm()
const opened = ref(false)
const error = ref('')
const value = ref(null)
const imageUrl = computed(() => visualField.value?.input === 'image' ? draft[visualField.value.key]?.url : '')
const position = computed(() => ({ objectPosition: `${(draft.image.focalX ?? .5) * 100}% ${(draft.image.focalY ?? .5) * 100}%` }))
const icon = computed(() => props.type === 'material' ? materialType(draft.kind).icon : { npc: UserRound, location: MapPin, quest: ScrollText }[props.type] || Image)
function open() {
  value.value = { ...draft[visualField.value.key] }
  error.value = ''; opened.value = true
}
async function save() {
  if (uploading.value || props.saving || busy.value) return
  if (props.editing) { updateField(visualField.value.key, value.value); opened.value = false; return }
  try { if (await saveField(visualField.value.key, value.value)) opened.value = false }
  catch (cause) { error.value = cause.message || 'Не удалось сохранить изображение' }
}
</script>
<style scoped>
.entity-visual-button { width: 104px; height: 104px; display: grid; flex: none; place-items: center; overflow: hidden; padding: 0; border: 0; border-radius: 18px; background: var(--surface-raised); color: var(--entity-detail-color, var(--accent)); }
button.entity-visual-button { cursor: pointer; }
.entity-visual-button img { width: 100%; height: 100%; object-fit: cover; }
.entity-visual-button:focus-visible { outline: 2px solid var(--accent); outline-offset: -3px; }
@media (max-width: 900px) { .entity-visual-button { width: 84px; height: 84px; } }
</style>
