<template>
  <header
    class="item-detail-header item-detail-header-covered"
    :class="{
      'item-detail-header-summary': $slots.summary,
      'item-detail-header-title-only-shade': titleOnlyShade,
      'item-detail-header-model': modelMode,
    }"
    :data-item-type-id="type?.id || undefined"
    :style="coverStyle"
  >
    <Transition name="item-detail-media">
    <ItemModelPreview v-if="modelMode" :key="item.id" :item="item" :frame="modelFrame" />
    <img
      v-else-if="coverImageAvailable"
      :key="displayedCoverUrl"
      class="item-detail-cover item-detail-cover-entering"
      :src="displayedCoverUrl"
      alt=""
      aria-hidden="true"
      @load="onCoverLoad"
      @error="onCoverError"
    />
    </Transition>
    <div class="item-detail-shade" aria-hidden="true"></div>

    <div v-if="coverLoading && !modelMode" class="item-detail-cover-loading">
      <LoadingIndicator label="Загрузка обложки" />
    </div>

    <div class="item-detail-overlay">
      <div class="item-detail-content">
        <div class="item-detail-title">
          <h1>{{ item.name }}</h1>
          <span v-if="formattedNameEn">{{ formattedNameEn }}</span>
        </div>
        <span v-if="item.userId != null" class="item-detail-custom">✦ ваше</span>
        <div v-if="$slots.actions || $slots.corner || item.modelId" class="item-detail-controls">
          <div class="item-detail-actions">
            <slot name="actions" />
          </div>
          <div v-if="$slots.corner || item.modelId" class="item-detail-corner">
            <ActionButton v-if="item.modelId" class="item-detail-model-toggle"
              :variant="modelMode ? 'primary' : 'secondary'" :aria-pressed="modelMode"
              aria-label="3D-модель" :title="modelMode ? 'Показать обложку' : 'Показать 3D-модель'"
              @click="modelMode = !modelMode">3D</ActionButton>
            <slot name="corner" />
          </div>
        </div>
      </div>

      <div v-if="$slots.summary" ref="summary" class="item-detail-summary">
        <slot name="summary" :has-cover="coverImageAvailable" />
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ActionButton, LoadingIndicator } from '@sylvieshare/share-ui'
import ItemModelPreview from '@/features/items/components/ItemModelPreview.vue'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})
const modelMode = ref(false), summary = ref(null)
const modelFrame = () => summary.value?.querySelector('.cover-summary-safe-zone')
watch([() => props.item.id, () => props.item.modelId], () => { modelMode.value = false })

const TYPE_COVER_STYLES = {
  2: {
    '--cover-min-height': '400px',
  },
  14: {
    '--cover-min-height': '400px',
  },
  5: {
    '--cover-min-height': '300px',
  },
  1: {
    '--cover-min-height': '420px',
  },
  6: {
    '--cover-min-height': '440px',
  },
  12: {
    '--cover-min-height': '420px',
  },
  13: {
    '--cover-min-height': '400px',
  },
  15: {
    '--cover-min-height': '320px',
  },
  8: {
    '--cover-min-height': '410px',
  },
  9: {
    '--cover-min-height': '410px',
  },
  16: {
    '--cover-min-height': '410px',
  },
  17: {
    '--cover-min-height': '410px',
  },
}

function defaultCoverAspectRatio(typeId) {
  if ([2, 8, 9, 11, 13, 14, 16, 17, 19].includes(typeId)) return '3 / 2'
  if ([3, 4, 5, 7, 10, 18].includes(typeId)) return '5 / 2'
  if (typeId === 1 || typeId === 6 || typeId === 12) return '4 / 3'
  if (typeId === 15) return '4 / 1'
  return ''
}

function coverAspectRatioForDimensions(width, height, typeId) {
  if (!(width > 0 && height > 0)) return defaultCoverAspectRatio(typeId)
  if ((typeId === 1 || typeId === 6 || typeId === 12) && height > width) return '1 / 1'
  return `${width} / ${height}`
}

const coverFailed = ref(false)
const coverAspectRatio = ref(defaultCoverAspectRatio(props.type?.id))
const requestedCoverUrl = computed(() => props.item.coverImageUrl || props.type?.coverImageUrl || '')
const displayedCoverUrl = ref('')
const coverLoading = ref(false)
let coverRequestVersion = 0

const coverImageAvailable = computed(() => Boolean(displayedCoverUrl.value) && !coverFailed.value)
const titleOnlyShade = computed(() => [3, 4, 7, 18].includes(props.type?.id))
const coverStyle = computed(() => ({
  ...(TYPE_COVER_STYLES[props.type?.id] || {}),
  ...(modelMode.value ? { '--cover-aspect-ratio': '4 / 3' } : coverAspectRatio.value ? { '--cover-aspect-ratio': coverAspectRatio.value } : {}),
}))
const formattedNameEn = computed(() => String(props.item.nameEn || '')
  .replace(/_/g, ' ')
  .replace(/\b[a-z]/g, char => char.toUpperCase()))

watch(
  () => [requestedCoverUrl.value, props.type?.id],
  ([url, typeId]) => {
    const requestVersion = ++coverRequestVersion
    if (url && url === displayedCoverUrl.value && !coverFailed.value) return
    displayedCoverUrl.value = ''
    coverLoading.value = Boolean(url)
    coverFailed.value = false
    coverAspectRatio.value = defaultCoverAspectRatio(typeId)

    if (!url) return

    const image = new Image()
    image.decoding = 'async'
    image.onload = async () => {
      try {
        await image.decode()
      } catch {
        // A decoded preload is preferred, but onload is enough to swap safely.
      }
      if (requestVersion !== coverRequestVersion) return

      coverAspectRatio.value = coverAspectRatioForDimensions(
        image.naturalWidth,
        image.naturalHeight,
        typeId,
      )
      coverFailed.value = false
      displayedCoverUrl.value = url
      coverLoading.value = false
    }
    image.onerror = () => {
      if (requestVersion !== coverRequestVersion) return
      displayedCoverUrl.value = ''
      coverLoading.value = false
      coverFailed.value = true
    }
    image.src = url
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  coverRequestVersion += 1
})

function onCoverLoad(event) {
  const width = event.currentTarget?.naturalWidth
  const height = event.currentTarget?.naturalHeight
  coverAspectRatio.value = coverAspectRatioForDimensions(width, height, props.type?.id)
}

function onCoverError() {
  coverFailed.value = true
  coverLoading.value = false
}
</script>

<style scoped src="./ItemDetailHeader.css"></style>
