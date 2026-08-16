<template>
  <div class="session-image-field">
    <div class="session-image-current">
      <img v-if="displayedUrl" :src="displayedUrl" :alt="currentLabel" :style="customSelected ? customPreviewStyle : null" />
      <div v-else class="session-image-placeholder"><Images :size="22" /></div>
      <div class="session-image-current-copy">
        <small>Текущее изображение</small>
        <strong>{{ currentLabel }}</strong>
      </div>
      <button type="button" @click="pickerOpen = true"><Images :size="15" />Сменить</button>
    </div>

    <AppModalFrame v-if="pickerOpen" extra-wide title="Выбрать изображение" @close="pickerOpen = false">
      <div class="session-image-browser">
        <nav v-if="categories.length" class="session-image-category-nav" aria-label="Категории изображений">
          <button v-for="category in categories" :key="category.key" type="button" @click="scrollTo(category.key)">{{ category.label }}</button>
        </nav>
        <button v-if="allowUpload" type="button" class="session-image-upload" @click="requestUpload">
          <Upload :size="18" />
          <span><strong>Загрузить своё</strong><small>PNG, JPG или WebP до 15 МБ</small></span>
        </button>
        <div v-if="loading" class="session-image-state">Загружаем изображения…</div>
        <div v-else-if="loadError" class="session-image-state error">Не удалось загрузить каталог</div>
        <div v-else class="session-image-sections">
          <section v-for="category in categories" :key="category.key" :ref="element => rememberSection(category.key, element)" class="session-image-section">
            <div class="session-image-divider"><span>{{ category.label }}</span></div>
            <div class="session-image-grid" role="radiogroup" :aria-label="category.label">
              <button
                v-for="image in category.images"
                :key="image.id"
                type="button"
                role="radio"
                class="session-image-option"
                :class="{ active: !customSelected && modelValue === image.id }"
                :aria-checked="!customSelected && modelValue === image.id"
                @click="selectImage(image)"
              >
                <img :src="image.url" :alt="image.label" />
                <span>{{ image.label }}</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </AppModalFrame>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Images, Upload } from '@lucide/vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { loadSessionImageCatalog } from '@/features/sessions/lib/sessionImageCatalog'
import { groupSessionImages } from '@/features/sessions/lib/sessionImages'

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  catalog: { type: String, default: 'story' },
  defaultKey: { type: String, default: '' },
  currentUrl: { type: String, default: '' },
  allowUpload: { type: Boolean, default: false },
  customSelected: { type: Boolean, default: false },
  customPreview: { type: String, default: '' },
  customPreviewStyle: { type: Object, default: null },
})
const emit = defineEmits(['select', 'upload'])
const pickerOpen = ref(false)
const images = ref([])
const loading = ref(true)
const loadError = ref(false)
const sections = new Map()
const categories = computed(() => groupSessionImages(images.value))
const selectedImage = computed(() => images.value.find(image => image.id === props.modelValue))
const displayedUrl = computed(() => props.customSelected ? props.customPreview : (selectedImage.value?.url || props.currentUrl))
const currentLabel = computed(() => props.customSelected
  ? 'Своё изображение'
  : (selectedImage.value?.label || (props.currentUrl ? 'Своё изображение' : 'Не выбрано')))

onMounted(async () => {
  try {
    images.value = await loadSessionImageCatalog(props.catalog)
    if (!props.modelValue && !props.customSelected && images.value[0]) {
      emit('select', images.value.find(image => image.key === props.defaultKey) || images.value[0])
    }
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
})

function rememberSection(key, element) {
  if (element) sections.set(key, element)
  else sections.delete(key)
}
function scrollTo(key) { sections.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
function selectImage(image) { emit('select', image); pickerOpen.value = false }
function requestUpload() { pickerOpen.value = false; emit('upload') }
</script>

<style scoped>
.session-image-field { min-width: 0; }
.session-image-current { min-height: 104px; display: grid; grid-template-columns: 126px minmax(0, 1fr) auto; align-items: center; gap: 14px; overflow: hidden; padding: 9px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-raised); }
.session-image-current > img, .session-image-placeholder { width: 126px; height: 86px; display: grid; place-items: center; border-radius: 8px; object-fit: cover; background: var(--surface); color: var(--text-muted); }
.session-image-current-copy { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.session-image-current-copy small { color: var(--text-muted); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
.session-image-current-copy strong { overflow: hidden; color: var(--text-1); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.session-image-current > button, .session-image-category-nav button { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-2); cursor: pointer; font: inherit; font-size: 12px; }
.session-image-current > button { min-height: 36px; padding: 7px 11px; }
.session-image-current > button:hover, .session-image-category-nav button:hover { border-color: var(--accent); color: var(--text-1); }
.session-image-browser { display: flex; flex-direction: column; gap: 14px; }
.session-image-category-nav { position: sticky; z-index: 2; top: -1px; display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0 10px; background: var(--surface); }
.session-image-category-nav button { padding: 6px 10px; border-radius: 999px; }
.session-image-upload { width: 100%; display: flex; align-items: center; gap: 10px; padding: 11px 13px; border: 1px dashed color-mix(in srgb, var(--accent) 45%, var(--border)); border-radius: 10px; background: color-mix(in srgb, var(--accent) 7%, transparent); color: var(--accent-soft); cursor: pointer; text-align: left; }
.session-image-upload span { display: flex; flex-direction: column; gap: 2px; }.session-image-upload strong { font-size: 12px; }.session-image-upload small { color: var(--text-muted); font-size: 10px; }
.session-image-state { padding: 34px; color: var(--text-muted); text-align: center; }.session-image-state.error { color: var(--danger); }
.session-image-sections { display: flex; flex-direction: column; gap: 22px; }
.session-image-section { scroll-margin-top: 54px; }
.session-image-divider { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; color: var(--text-2); font-size: 11px; font-weight: 750; text-transform: uppercase; letter-spacing: .08em; }
.session-image-divider::after { content: ''; height: 1px; flex: 1; background: var(--border); }
.session-image-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.session-image-option { position: relative; min-width: 0; height: 112px; overflow: hidden; padding: 0; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); color: var(--text-on-accent); cursor: pointer; }
.session-image-option img { width: 100%; height: 100%; display: block; object-fit: cover; }
.session-image-option::after { content: ''; position: absolute; inset: 45% 0 0; background: linear-gradient(transparent, color-mix(in srgb, var(--bg) 88%, transparent)); }
.session-image-option span { position: absolute; z-index: 1; right: 8px; bottom: 6px; left: 8px; overflow: hidden; font-size: 11px; font-weight: 700; text-align: left; text-overflow: ellipsis; text-shadow: 0 1px 3px var(--bg); white-space: nowrap; }
.session-image-option.active { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent), 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent); }
@media (max-width: 640px) { .session-image-current { grid-template-columns: 92px minmax(0, 1fr); }.session-image-current > img, .session-image-placeholder { width: 92px; }.session-image-current > button { grid-column: 1 / -1; justify-content: center; }.session-image-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
