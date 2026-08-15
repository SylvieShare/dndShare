<template>
  <AppModalFrame extra-wide :title="chapter ? 'Редактировать главу' : 'Новая глава'" @close="$emit('close')">
    <div class="chapter-form-grid">
      <FormField label="Номер" vertical>
        <FormTextInput v-model:value="draft.number" :maxlength="24" placeholder="1, 3А или Пролог" autofocus />
      </FormField>
      <FormField label="Статус" vertical>
        <FormSelect v-model:value="draft.status">
          <option v-for="status in CHAPTER_STATUSES" :key="status.key" :value="status.key">{{ status.label }}</option>
        </FormSelect>
      </FormField>
    </div>

    <FormField label="Название" vertical>
      <FormTextInput v-model:value="draft.name" :maxlength="160" @enter="submit" />
    </FormField>
    <FormField label="Описание" vertical>
      <FormTextarea v-model:value="draft.description" :rows="3" :maxlength="2000" placeholder="Что происходит в этой главе" />
    </FormField>

    <div class="chapter-image-section">
      <div class="chapter-image-title">Изображение</div>
      <SessionImagePicker
        :model-value="draft.imagePresetKey"
        allow-upload
        :custom-selected="source === 'custom'"
        :custom-preview="customPreview"
        :custom-preview-style="previewPosition"
        @select="pickPreset"
        @upload="fileInput?.click()"
      />
      <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
      <div v-if="uploadError" class="chapter-upload-error">{{ uploadError }}</div>
      <div v-if="source === 'custom' && customPreview" class="chapter-focal-grid">
        <FormField label="Фокус по горизонтали" vertical>
          <input v-model.number="draft.imageFocalX" class="chapter-range" type="range" min="0" max="1" step="0.01" />
        </FormField>
        <FormField label="Фокус по вертикали" vertical>
          <input v-model.number="draft.imageFocalY" class="chapter-range" type="range" min="0" max="1" step="0.01" />
        </FormField>
      </div>
    </div>

    <template #footer>
      <FormActionButtons
        :submit-text="chapter ? 'Сохранить' : 'Создать главу'"
        loading-text="Сохранение…"
        :loading="saving || uploading"
        :can-submit="!!draft.number.trim() && !!draft.name.trim()"
        @cancel="$emit('close')"
        @submit="submit"
      />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormSelect } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import { FormTextarea } from '@sylvieshare/share-ui'
import SessionImagePicker from '@/features/sessions/components/SessionImagePicker.vue'
import { CHAPTER_STATUSES } from '@/features/sessions/lib/chapterGraph'

const props = defineProps({
  chapter: { type: Object, default: null },
  arcId: { type: Number, required: true },
  position: { type: Object, default: () => ({ x: 80, y: 80 }) },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'save'])

const draft = reactive({
  number: props.chapter?.number ?? '',
  name: props.chapter?.name ?? '',
  description: props.chapter?.description ?? '',
  status: props.chapter?.status ?? 'planned',
  imagePresetKey: props.chapter?.imagePresetKey ?? 'city',
  customImageId: props.chapter?.customImageId ?? null,
  imageFocalX: props.chapter?.imageFocalX ?? 0.5,
  imageFocalY: props.chapter?.imageFocalY ?? 0.5,
})
const source = ref(props.chapter?.customImageUrl ? 'custom' : 'preset')
const fileInput = ref(null)
const selectedFile = ref(null)
const customPreview = ref(props.chapter?.customImageUrl ?? '')
const objectUrl = ref('')
const uploading = ref(false)
const uploadError = ref('')
const previewPosition = computed(() => ({ objectPosition: `${draft.imageFocalX * 100}% ${draft.imageFocalY * 100}%` }))

function pickPreset(key) {
  source.value = 'preset'
  draft.imagePresetKey = key
}

function onFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    uploadError.value = 'Выберите файл изображения'
    return
  }
  if (file.size > 15 * 1024 * 1024) {
    uploadError.value = 'Файл слишком большой — максимум 15 МБ'
    return
  }
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = URL.createObjectURL(file)
  selectedFile.value = file
  customPreview.value = objectUrl.value
  source.value = 'custom'
  uploadError.value = ''
}

async function uploadSelected() {
  if (!selectedFile.value) return { id: draft.customImageId }
  uploading.value = true
  try {
    const form = new FormData()
    form.append('file', selectedFile.value)
    const response = await fetch('/api/storage/images', { method: 'POST', body: form })
    if (!response.ok) throw new Error(String(response.status))
    const data = await response.json()
    return { id: data.upload_id }
  } finally {
    uploading.value = false
  }
}

async function submit() {
  if (!draft.number.trim() || !draft.name.trim() || props.saving || uploading.value) return
  uploadError.value = ''
  try {
    const custom = source.value === 'custom' ? await uploadSelected() : { id: null }
    emit('save', {
      arcId: props.arcId,
      number: draft.number.trim(),
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      status: draft.status,
      imagePresetKey: source.value === 'preset' ? draft.imagePresetKey : null,
      customImageId: source.value === 'custom' ? custom.id : null,
      imageFocalX: draft.imageFocalX,
      imageFocalY: draft.imageFocalY,
      positionX: props.chapter?.positionX ?? props.position.x,
      positionY: props.chapter?.positionY ?? props.position.y,
    })
  } catch {
    uploadError.value = 'Не удалось загрузить изображение'
  }
}

onBeforeUnmount(() => { if (objectUrl.value) URL.revokeObjectURL(objectUrl.value) })
</script>

<style scoped>
.chapter-form-grid,
.chapter-focal-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}

.chapter-image-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chapter-image-title {
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
}

.chapter-range { width: 100%; accent-color: var(--accent); }
.chapter-upload-error { color: var(--danger); font-size: 12px; }

@media (max-width: 640px) {
  .chapter-form-grid, .chapter-focal-grid { grid-template-columns: 1fr; }
}
</style>
