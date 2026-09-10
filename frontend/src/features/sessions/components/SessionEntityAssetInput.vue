<template>
  <div class="entity-asset-input" :class="{ 'entity-asset-input--direct': direct }">
    <SessionImagePicker
      v-if="!video"
      :model-value="modelValue.id"
      :current-url="modelValue.url"
      :catalog="catalog"
      :default-key="catalog === 'npc' ? 'npc-scholar' : 'city'"
      :allow-upload="allowUpload"
      :dialog-only="direct"
      :disabled="uploading || saving"
      :error-message="error || errorMessage"
      :allow-empty="direct"
      @close="$emit('close')"
      hide-preview
      @select="selectImage"
      @upload="fileInput?.click()"
    />
    <template v-else>
      <span>{{ modelValue.id ? 'Видеофайл выбран' : 'Видеофайл не выбран' }}</span>
      <AddButton label="Выбрать видео" :disabled="uploading" @click="fileInput?.click()" />
    </template>
    <input ref="fileInput" type="file" :accept="video ? 'video/*' : 'image/*'" hidden @change="upload" />
    <LoadingIndicator v-if="uploading && !direct" label="Загрузка…" size="xs" inline show-label />
    <span v-if="error && !direct" class="entity-asset-error" role="alert">{{ error }}</span>
  </div>
</template>
<script setup>
import { LoadingIndicator } from '@sylvieshare/share-ui'
import { ref } from 'vue'
import { AddButton } from '@sylvieshare/share-ui'
import SessionImagePicker from './SessionImagePicker.vue'
const props = defineProps({ modelValue: { type: Object, required: true }, catalog: { type: String, default: 'story' }, video: Boolean, allowUpload: Boolean, direct: Boolean, saving: Boolean, errorMessage: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue', 'busy', 'close'])
const fileInput = ref(null)
const uploading = ref(false)
const error = ref('')
function selectImage(image) { emit('update:modelValue', { ...props.modelValue, id: image.id, url: image.url || '' }) }
async function upload(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || uploading.value) return
  const maxMb = props.video ? 100 : 15
  if (!file.type.startsWith(props.video ? 'video/' : 'image/') || file.size > maxMb * 1024 * 1024) {
    error.value = `Выберите ${props.video ? 'видео' : 'изображение'} до ${maxMb} МБ`
    return
  }
  uploading.value = true; error.value = ''; emit('busy', true)
  try {
    const form = new FormData(); form.append('file', file)
    const response = await fetch(props.video ? '/api/storage/videos' : '/api/storage/images', { method: 'POST', body: form })
    if (!response.ok) throw new Error('Не удалось загрузить файл')
    const asset = await response.json()
    uploading.value = false; emit('busy', false)
    emit('update:modelValue', { ...props.modelValue, id: asset.upload_id, url: asset.url || '' })
  } catch (cause) { error.value = cause.message || 'Не удалось загрузить файл' }
  finally { uploading.value = false; emit('busy', false) }
}
</script>
<style scoped>
.entity-asset-input { display: flex; flex-direction: column; gap: 8px; }
.entity-asset-input--direct { display: contents; }
.entity-asset-error { color: var(--danger); }
</style>
