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
    @click="canUpload && fileInput.click()"
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

    <!-- Оверлей «изменить» при наведении поверх картинки -->
    <div v-if="imageUrl && charCtx.ownerMode" class="avatar-change-overlay">
      <svg class="avatar-upload-icon" viewBox="0 0 24 24" fill="none">
        <path d="M12 16V8M12 8L9 11M12 8L15 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M6 20H18M3 14v2a3 3 0 003 3h12a3 3 0 003-3v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      style="display:none"
      @change="onFileChange"
    />
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true, dictionaries: {}, var: {} })
const isDragging = ref(false)
const uploading = ref(false)
const imageUrl = ref(null)
const fileInput = ref(null)
const avatarEl = ref(null)

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
  if (!value) return null
  if (typeof value === 'string') return value
  if (value.url) return value.url
  return null
}

function onDrop(e) {
  isDragging.value = false
  if (!canUpload.value) return
  const file = e.dataTransfer.files[0]
  if (file && file.type.startsWith('image/')) upload(file)
}

function onFileChange(e) {
  const file = e.target.files[0]
  if (file) upload(file)
  e.target.value = ''
}

async function upload(file) {
  if (file.size > 8 * 1024 * 1024) {
    alert('Файл слишком большой (максимум 8 МБ)')
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
  } finally {
    uploading.value = false
  }
}
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
</style>
