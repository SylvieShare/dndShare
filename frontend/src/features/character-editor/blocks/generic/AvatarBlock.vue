<template>
  <div
    ref="avatarEl"
    class="avatar"
    :style="avatarStyle"
    :class="{
      'avatar-dragging': isDragging,
      'avatar-has-image': imageUrl,
      'avatar-editable': canUpload,
      'avatar-fill': isFill,
    }"
    @dragover.prevent="canUpload && (isDragging = true)"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
    @click="openActions"
    @keydown.enter.prevent="openActions"
    @keydown.space.prevent="openActions"
    :role="canUpload ? 'button' : undefined"
    :tabindex="canUpload ? 0 : undefined"
    :aria-label="canUpload ? 'Действия с портретом' : undefined"
  >
    <!-- Картинка -->
    <img v-if="imageUrl" :src="imageUrl" class="avatar-img" alt="avatar" />

    <!-- Загрузка -->
    <div v-else-if="uploading" class="avatar-overlay">
      <span class="avatar-spinner"></span>
    </div>

    <!-- Пустой плейсхолдер в режиме редактирования -->
    <div v-else-if="canUpload" class="avatar-overlay">
      <svg class="avatar-upload-icon" viewBox="0 0 24 24" fill="none">
        <path d="M12 16V8M12 8L9 11M12 8L15 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M6 20H18M3 14v2a3 3 0 003 3h12a3 3 0 003-3v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      <span class="avatar-hint">{{ isDragging ? 'Отпустите' : 'Фото' }}</span>
    </div>

    <!-- Оверлей действий при наведении поверх картинки -->
    <div v-if="imageUrl && charCtx.ownerMode" class="avatar-change-overlay">
      <span>Изменить</span>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      style="display:none"
      @change="onFileChange"
    />
    <input
      ref="iconFileInput"
      type="file"
      accept=".png,.webp,image/png,image/webp"
      style="display:none"
      @change="onIconFileChange"
    />
    <span v-if="uploadError" class="avatar-error">{{ uploadError }}</span>
  </div>

  <BasePopover v-model:open="actionsOpen" :anchor="avatarEl" placement="bottom-start" :min-width="180" :z-index="3200">
    <div class="avatar-actions" role="menu" aria-label="Действия с портретом">
      <button type="button" role="menuitem" @click="chooseFile">Загрузить изображение</button>
      <button type="button" role="menuitem" @click="chooseIconFile">Загрузить иконку</button>
      <button v-if="imageUrl" type="button" role="menuitem" @click="cropCurrent">Кадрировать</button>
      <div v-if="imageUrl" class="avatar-actions-separator" />
      <button v-if="imageUrl" type="button" role="menuitem" class="avatar-action-danger" @click="clearImage">Очистить</button>
    </div>
  </BasePopover>

  <AvatarCropModal
    v-if="cropSource"
    :src="cropSource"
    :aspect="cropAspect"
    @close="closeCrop"
    @crop="uploadCrop"
  />
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BasePopover } from '@sylvieshare/share-ui'
import AvatarCropModal from '@/features/character-editor/components/AvatarCropModal.vue'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true, dictionaries: {}, var: {} })
const isDragging = ref(false)
const uploading = ref(false)
const iconUploading = ref(false)
const imageUrl = ref(null)
const fileInput = ref(null)
const iconFileInput = ref(null)
const avatarEl = ref(null)
const uploadError = ref('')
const actionsOpen = ref(false)
const cropSource = ref('')
const cropFileName = ref('portrait.webp')
const cropAspect = ref(1)
let cropObjectUrl = ''

// `fill` → stretch to the container's full height (corners clipped by the container's overflow)
const isFill = computed(() => props.block.props?.fill === true || props.block.props?.fill === 'true')
const avatarSize = computed(() => {
  const w = props.block.props?.width ?? (props.block.content?.width != null ? props.block.content.width + 'px' : null)
  const h = props.block.props?.height ?? (props.block.content?.height != null ? props.block.content.height + 'px' : null)
  // fill: omit height (unless an explicit cap is given) so the flex container's `align-items/self:
  // stretch` sizes it to full height; an explicit height caps it (top of the image is shown).
  if (isFill.value) return h ? { width: w || '120px', maxHeight: h } : { width: w || '120px' }
  return { width: w || '120px', height: h || '120px' }
})
const avatarStyle = computed(() => avatarSize.value)
const canUpload = computed(() => charCtx.ownerMode)

onMounted(() => {
  imageUrl.value = resolveImageUrl(props.value)
})
watch(() => props.value, value => {
  imageUrl.value = resolveImageUrl(value)
}, { deep: true })

function resolveImageUrl(value) {
  return value && typeof value === 'object' ? (value.url || null) : null
}

function onDrop(e) {
  isDragging.value = false
  if (!canUpload.value) return
  const file = e.dataTransfer.files[0]
  if (file && file.type.startsWith('image/')) openFileCrop(file)
}

function onFileChange(e) {
  const file = e.target.files[0]
  if (file) openFileCrop(file)
  e.target.value = ''
}

function onIconFileChange(e) {
  const file = e.target.files[0]
  if (file) uploadIcon(file)
  e.target.value = ''
}

function openActions() {
  if (!canUpload.value || uploading.value || iconUploading.value) return
  actionsOpen.value = !actionsOpen.value
}

function chooseFile() {
  actionsOpen.value = false
  fileInput.value?.click()
}

function chooseIconFile() {
  actionsOpen.value = false
  iconFileInput.value?.click()
}

function clearCropObjectUrl() {
  if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl)
  cropObjectUrl = ''
}

function setCropSource(blob, fileName = 'portrait.webp') {
  clearCropObjectUrl()
  cropObjectUrl = URL.createObjectURL(blob)
  cropSource.value = cropObjectUrl
  cropFileName.value = fileName.replace(/\.[^.]+$/, '') + '.webp'
  const rect = avatarEl.value?.getBoundingClientRect()
  cropAspect.value = rect?.width && rect?.height ? rect.width / rect.height : 1
}

function openFileCrop(file) {
  actionsOpen.value = false
  uploadError.value = ''
  if (file.size > 8 * 1024 * 1024) {
    uploadError.value = 'Файл слишком большой (максимум 8 МБ)'
    return
  }
  setCropSource(file, file.name || 'portrait.webp')
}

async function cropCurrent() {
  actionsOpen.value = false
  uploadError.value = ''
  try {
    const source = props.value?.upload_id
      ? `/api/storage/images/${props.value.upload_id}`
      : imageUrl.value
    const response = await fetch(source)
    if (!response.ok) throw new Error(String(response.status))
    setCropSource(await response.blob(), 'portrait.webp')
  } catch {
    uploadError.value = 'Не удалось открыть изображение для кадрирования'
  }
}

function closeCrop() {
  cropSource.value = ''
  clearCropObjectUrl()
}

function uploadCrop(blob) {
  const file = new File([blob], cropFileName.value, { type: blob.type || 'image/webp' })
  closeCrop()
  upload(file)
}

async function uploadIcon(file) {
  uploadError.value = ''
  iconUploading.value = true
  try {
    if (typeof charCtx.uploadCharacterIcon !== 'function') throw new Error('icon upload is unavailable')
    await charCtx.uploadCharacterIcon(file)
  } catch (error) {
    uploadError.value = error?.message || 'Не удалось загрузить иконку'
  } finally {
    iconUploading.value = false
  }
}

function clearImage() {
  actionsOpen.value = false
  imageUrl.value = null
  uploadError.value = ''
  emit('update:value', props.block.id, null)
}

async function upload(file) {
  uploadError.value = ''
  if (file.size > 8 * 1024 * 1024) {
    uploadError.value = 'Файл слишком большой (максимум 8 МБ)'
    return
  }
  uploading.value = true
  imageUrl.value = null
  try {
    const formData = new FormData()
    formData.append('file', file)
    if (props.value?.upload_id) formData.append('old_upload_id', props.value.upload_id)
    const res = await fetch('/api/storage/images', { method: 'POST', body: formData })
    if (!res.ok) throw new Error(res.status)
    const data = await res.json()
    imageUrl.value = data.url
    emit('update:value', props.block.id, { url: data.url, upload_id: data.upload_id })
  } catch {
    imageUrl.value = resolveImageUrl(props.value)
    uploadError.value = 'Не удалось загрузить изображение'
  } finally {
    uploading.value = false
  }
}

onBeforeUnmount(clearCropObjectUrl)
</script>

<style scoped>
.avatar {
  position: relative;
  background-color: color-mix(in srgb, var(--accent) 18%, var(--surface));
  border-radius: 16px;
  flex-shrink: 0;
  overflow: hidden;
  transition: box-shadow 0.2s ease;
}

.avatar-error {
  position: absolute;
  inset: auto 0 4px;
  padding: 2px 4px;
  color: var(--danger);
  background: var(--surface);
  font-size: 10px;
  line-height: 1.2;
  text-align: center;
}

/* fill mode: flush to the container edges, no own rounding (container clips), stretches full height */
.avatar-fill {
  border-radius: 0;
  align-self: stretch;
}

.avatar-editable {
  cursor: pointer;
}

.avatar-editable:hover {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 50%, transparent);
}

.avatar-dragging {
  box-shadow: 0 0 0 2px var(--accent), 0 0 20px color-mix(in srgb, var(--accent) 40%, transparent) !important;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  display: block;
}

/* Базовый оверлей (пустой + загрузка) */
.avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: color-mix(in srgb, var(--accent) 55%, transparent);
}

.avatar-upload-icon {
  width: 32px;
  height: 32px;
}

.avatar-hint {
  font-size: 12px;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--accent) 50%, transparent);
}

/* Оверлей «изменить» поверх картинки */
.avatar-change-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--scrim) 81%, transparent);
  color: color-mix(in srgb, var(--text-on-accent) 80%, transparent);
  opacity: 0;
  transition: opacity 0.18s ease;
  border-radius: 16px;
}

.avatar-change-overlay span { font-size: 12px; font-weight: 650; }

.avatar-has-image.avatar-editable:hover .avatar-change-overlay {
  opacity: 1;
}

/* Спиннер */
.avatar-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid color-mix(in srgb, var(--accent) 25%, transparent);
  border-top-color: color-mix(in srgb, var(--accent) 75%, transparent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.avatar-actions { display: flex; flex-direction: column; gap: 2px; padding: 5px; }
.avatar-actions button {
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.avatar-actions button:hover { background: var(--surface-raised); color: var(--text-1); }
.avatar-actions .avatar-action-danger { color: var(--danger); }
.avatar-actions-separator { height: 1px; margin: 3px 5px; background: var(--border); }
</style>
