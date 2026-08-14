<template>
  <div class="session-image-picker">
    <div class="session-image-categories" role="tablist" aria-label="Категория изображений">
      <button
        v-for="category in SESSION_IMAGE_CATEGORIES"
        :key="category.key"
        type="button"
        role="tab"
        class="session-image-category"
        :class="{ active: activeCategory === category.key }"
        :aria-selected="activeCategory === category.key"
        @click="activeCategory = category.key"
      >
        {{ category.label }}
      </button>
    </div>

    <div class="session-image-grid" role="radiogroup" aria-label="Изображение">
      <button
        v-for="preset in visiblePresets"
        :key="preset.key"
        type="button"
        role="radio"
        class="session-image-option"
        :class="{ active: !customSelected && modelValue === preset.key }"
        :aria-checked="!customSelected && modelValue === preset.key"
        @click="$emit('select', preset.key)"
      >
        <img :src="sessionImagePresetUrl(preset.key)" :alt="preset.label" />
        <span>{{ preset.label }}</span>
      </button>
      <button
        v-if="allowUpload"
        type="button"
        class="session-image-option session-image-option--upload"
        :class="{ active: customSelected }"
        @click="$emit('upload')"
      >
        <img v-if="customPreview" :src="customPreview" alt="Своё изображение" :style="customPreviewStyle" />
        <span v-else class="session-image-upload-plus">+</span>
        <span>{{ customPreview ? 'Своё изображение' : 'Загрузить своё' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  SESSION_IMAGE_CATEGORIES,
  sessionImageCategory,
  sessionImagePresetUrl,
} from '@/features/sessions/lib/sessionImages'

const props = defineProps({
  modelValue: { type: String, default: '' },
  allowUpload: { type: Boolean, default: false },
  customSelected: { type: Boolean, default: false },
  customPreview: { type: String, default: '' },
  customPreviewStyle: { type: Object, default: null },
})
defineEmits(['select', 'upload'])

const activeCategory = ref(sessionImageCategory(props.modelValue).key)
const visiblePresets = computed(() => SESSION_IMAGE_CATEGORIES.find(category => category.key === activeCategory.value)?.presets ?? [])

watch(() => props.modelValue, key => {
  if (!key) return
  activeCategory.value = sessionImageCategory(key).key
})
</script>

<style scoped>
.session-image-picker { display: flex; flex-direction: column; gap: 9px; }
.session-image-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.session-image-category {
  min-height: 30px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text-2);
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
}
.session-image-category:hover { border-color: var(--border-strong); color: var(--text-1); }
.session-image-category.active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, var(--surface-raised));
  color: var(--accent-soft);
}
.session-image-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.session-image-option {
  position: relative;
  min-width: 0;
  height: 86px;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-raised);
  color: var(--text-on-accent);
  cursor: pointer;
}
.session-image-option img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.session-image-option::after {
  content: '';
  position: absolute;
  inset: 38% 0 0;
  background: linear-gradient(transparent, color-mix(in srgb, var(--bg) 86%, transparent));
}
.session-image-option > span:last-child {
  position: absolute;
  z-index: 1;
  right: 7px;
  bottom: 5px;
  left: 7px;
  overflow: hidden;
  font-size: 11px;
  font-weight: 700;
  text-align: left;
  text-overflow: ellipsis;
  text-shadow: 0 1px 3px var(--bg);
  white-space: nowrap;
}
.session-image-option.active {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent), 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent);
}
.session-image-option--upload {
  display: grid;
  place-items: center;
  color: var(--text-2);
}
.session-image-upload-plus { font-size: 24px; color: var(--accent); }

@media (max-width: 640px) {
  .session-image-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
