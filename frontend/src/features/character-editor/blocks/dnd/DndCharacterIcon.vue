<template>
  <div class="dci-icon-wrap">
    <button
      v-if="canEdit"
      ref="iconEl"
      class="dci-icon dci-icon--interactive"
      type="button"
      aria-label="Изменить иконку персонажа"
      @click.stop="menuOpen = !menuOpen"
    >
      <img v-if="imageUrl" :src="imageUrl" alt="" />
      <span v-else>{{ monogram }}</span>
      <span v-if="uploading" class="dci-icon-spinner" aria-label="Загрузка"></span>
    </button>
    <div v-else class="dci-icon" aria-hidden="true">
      <img v-if="imageUrl" :src="imageUrl" alt="" />
      <span v-else>{{ monogram }}</span>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".png,.webp,image/png,image/webp"
      hidden
      @change="onFileChange"
    />

    <BasePopover v-if="canEdit" v-model:open="menuOpen" :anchor="iconEl" placement="bottom-start" :min-width="150" :z-index="3200">
      <div class="dci-icon-menu" role="menu" aria-label="Действия с иконкой">
        <button type="button" role="menuitem" @click="chooseFile">Загрузить</button>
        <button v-if="hasOwnIcon" type="button" role="menuitem" class="dci-icon-clear" @click="clearIcon">Очистить</button>
        <span v-if="error" class="dci-icon-error" role="alert">{{ error }}</span>
      </div>
    </BasePopover>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { BasePopover } from '@sylvieshare/share-ui'

const props = defineProps({
  values: { type: Object, default: () => ({}) },
})
const charCtx = inject('charCtx', {})
const iconEl = ref(null)
const fileInput = ref(null)
const menuOpen = ref(false)
const uploading = ref(false)
const error = ref('')

const canEdit = computed(() => !!charCtx.ownerMode)
const hasOwnIcon = computed(() => !!charCtx.iconImageUrl)
const imageUrl = computed(() => charCtx.iconImageUrl || props.values?.ava?.url || '')
const monogram = computed(() => String(props.values?.name || '?').trim().slice(0, 1).toUpperCase() || '?')

function chooseFile() {
  menuOpen.value = false
  error.value = ''
  fileInput.value?.click()
}

async function onFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  uploading.value = true
  error.value = ''
  try {
    if (typeof charCtx.uploadCharacterIcon !== 'function') throw new Error('Загрузка недоступна')
    await charCtx.uploadCharacterIcon(file)
  } catch (uploadError) {
    error.value = uploadError?.message || 'Не удалось загрузить иконку'
    menuOpen.value = true
  } finally {
    uploading.value = false
  }
}

async function clearIcon() {
  menuOpen.value = false
  error.value = ''
  try {
    if (typeof charCtx.clearCharacterIcon !== 'function') throw new Error('Очистка недоступна')
    await charCtx.clearCharacterIcon()
  } catch (clearError) {
    error.value = clearError?.message || 'Не удалось очистить иконку'
    menuOpen.value = true
  }
}
</script>

<style scoped>
.dci-icon-wrap {
  position: relative;
  width: 88px;
  flex: 0 0 88px;
  margin-top: 15px;
  margin-left: 15px;
}
.dci-icon {
  position: relative;
  display: grid;
  width: 88px;
  height: 88px;
  box-sizing: border-box;
  place-items: center;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: 18px;
  background: none;
  color: var(--accent-soft);
  font: inherit;
  font-size: 30px;
  font-weight: 800;
}
.dci-icon--interactive { cursor: pointer; }
.dci-icon--interactive:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.dci-icon img { display: block; width: 100%; height: 100%; object-fit: cover; }
.dci-icon-spinner {
  position: absolute;
  width: 24px;
  height: 24px;
  border: 3px solid color-mix(in srgb, var(--text-on-accent) 28%, transparent);
  border-top-color: var(--text-on-accent);
  border-radius: 50%;
  animation: dci-icon-spin 0.8s linear infinite;
}
.dci-icon-menu { display: flex; flex-direction: column; gap: 2px; padding: 5px; }
.dci-icon-menu button {
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
.dci-icon-menu button:hover { background: var(--surface-raised); color: var(--text-1); }
.dci-icon-menu .dci-icon-clear { color: var(--danger); }
.dci-icon-error { max-width: 220px; padding: 6px 10px; color: var(--danger); font-size: 10px; line-height: 1.35; }
@keyframes dci-icon-spin { to { transform: rotate(360deg); } }
</style>
