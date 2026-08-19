<template>
  <header
    class="item-detail-header"
    :class="{
      'item-detail-header-covered': hasCover,
      'item-detail-header-summary': $slots.summary,
    }"
    :data-item-type-id="type?.id || undefined"
    :style="coverStyle"
  >
    <img
      v-if="previousCoverUrl"
      class="item-detail-cover item-detail-cover-previous"
      :src="previousCoverUrl"
      alt=""
      aria-hidden="true"
    />
    <img
      v-if="hasCover"
      :key="displayedCoverUrl"
      class="item-detail-cover"
      :class="{ 'item-detail-cover-entering': previousCoverUrl }"
      :src="displayedCoverUrl"
      alt=""
      aria-hidden="true"
      @load="onCoverLoad"
      @error="onCoverError"
    />
    <div class="item-detail-shade" aria-hidden="true"></div>

    <div class="item-detail-overlay">
      <div class="item-detail-content">
        <ItemIcon
          v-if="!hasCover && (item.iconImageUrl || item.svg || type?.iconImageUrl)"
          class="item-detail-icon"
          :item="item"
          :type="type"
          :size="42"
        />
        <div class="item-detail-title">
          <h1>{{ item.name }}</h1>
          <span v-if="formattedNameEn">{{ formattedNameEn }}</span>
        </div>
        <span v-if="item.userId != null" class="item-detail-custom">✦ ваше</span>
        <div v-if="$slots.actions || $slots.corner" class="item-detail-controls">
          <div class="item-detail-actions">
            <slot name="actions" />
          </div>
          <div v-if="$slots.corner" class="item-detail-corner">
            <slot name="corner" />
          </div>
        </div>
      </div>

      <div v-if="$slots.summary" class="item-detail-summary">
        <slot name="summary" />
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const TYPE_COVER_STYLES = {
  1: {
    '--cover-min-height': '420px',
  },
  6: {
    '--cover-min-height': '440px',
  },
  12: {
    '--cover-min-height': '420px',
  },
}

function defaultCoverAspectRatio(typeId) {
  if (typeId === 5) return '4 / 1'
  if (typeId === 1 || typeId === 6 || typeId === 12) return '4 / 3'
  return ''
}

function coverAspectRatioForDimensions(width, height, typeId) {
  if (!(width > 0 && height > 0)) return defaultCoverAspectRatio(typeId)
  if ((typeId === 1 || typeId === 6 || typeId === 12) && height > width) return '1 / 1'
  return `${width} / ${height}`
}

const coverFailed = ref(false)
const coverAspectRatio = ref(defaultCoverAspectRatio(props.type?.id))
const displayedCoverUrl = ref(props.item.coverImageUrl || '')
const previousCoverUrl = ref('')
let coverRequestVersion = 0
let coverSwapTimer = null

const hasCover = computed(() => Boolean(displayedCoverUrl.value) && !coverFailed.value)
const coverStyle = computed(() => ({
  ...(TYPE_COVER_STYLES[props.type?.id] || {}),
  ...(hasCover.value && coverAspectRatio.value ? { '--cover-aspect-ratio': coverAspectRatio.value } : {}),
}))
const formattedNameEn = computed(() => String(props.item.nameEn || '')
  .replace(/_/g, ' ')
  .replace(/\b[a-z]/g, char => char.toUpperCase()))

watch(
  () => [props.item.coverImageUrl || '', props.type?.id],
  ([url, typeId]) => {
    const requestVersion = ++coverRequestVersion
    coverFailed.value = false
    coverAspectRatio.value = defaultCoverAspectRatio(typeId)

    if (!url) {
      clearCoverSwapTimer()
      previousCoverUrl.value = ''
      displayedCoverUrl.value = ''
      return
    }
    if (url === displayedCoverUrl.value) return

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
      clearCoverSwapTimer()
      coverFailed.value = false
      previousCoverUrl.value = displayedCoverUrl.value
      displayedCoverUrl.value = url
      if (previousCoverUrl.value) {
        coverSwapTimer = globalThis.setTimeout(() => {
          previousCoverUrl.value = ''
          coverSwapTimer = null
        }, 180)
      }
    }
    image.onerror = () => {
      if (requestVersion !== coverRequestVersion) return
      clearCoverSwapTimer()
      previousCoverUrl.value = ''
      displayedCoverUrl.value = ''
      coverFailed.value = true
    }
    image.src = url
  },
)

onBeforeUnmount(() => {
  coverRequestVersion += 1
  clearCoverSwapTimer()
})

function clearCoverSwapTimer() {
  if (coverSwapTimer == null) return
  globalThis.clearTimeout(coverSwapTimer)
  coverSwapTimer = null
}

function onCoverLoad(event) {
  const width = event.currentTarget?.naturalWidth
  const height = event.currentTarget?.naturalHeight
  coverAspectRatio.value = coverAspectRatioForDimensions(width, height, props.type?.id)
}

function onCoverError() {
  coverFailed.value = true
}
</script>

<style scoped>
.item-detail-header {
  position: relative;
  isolation: isolate;
  flex: 0 0 auto;
  min-height: 86px;
  box-sizing: border-box;
  display: flex;
  align-items: flex-end;
  margin: -16px -20px 16px;
  overflow: hidden;
  background:
    radial-gradient(circle at 24% 20%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 44%),
    linear-gradient(125deg, color-mix(in srgb, var(--surface) 92%, var(--accent)), var(--bg));
  border-bottom: 1px solid var(--border);
}

.item-detail-header-covered {
  aspect-ratio: var(--cover-aspect-ratio, auto);
  min-height: 0;
}

.item-detail-header-summary {
  align-items: stretch;
}

.item-detail-header-covered.item-detail-header-summary {
  aspect-ratio: auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.item-detail-header-covered.item-detail-header-summary::before {
  content: '';
  grid-area: 1 / 1;
  width: 100%;
  min-height: var(--cover-min-height, 440px);
  aspect-ratio: var(--cover-aspect-ratio, auto);
}

.item-detail-header-covered .item-detail-title h1 {
  color: var(--text-on-accent);
}

.item-detail-header-covered .item-detail-title span {
  color: color-mix(in srgb, var(--text-on-accent) 72%, transparent);
}

.item-detail-cover,
.item-detail-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.item-detail-cover {
  z-index: -2;
  object-fit: cover;
  object-position: center;
}

.item-detail-cover-previous {
  z-index: -3;
}

.item-detail-cover-entering {
  animation: item-detail-cover-enter 160ms cubic-bezier(.2, .7, .2, 1) both;
}

@keyframes item-detail-cover-enter {
  from {
    opacity: 0;
    transform: scale(1.008);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.item-detail-shade {
  z-index: -1;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--scrim) 92%, transparent) 0%, color-mix(in srgb, var(--scrim) 42%, transparent) 60%, color-mix(in srgb, var(--scrim) 18%, transparent) 100%),
    linear-gradient(0deg, var(--scrim) 0%, color-mix(in srgb, var(--scrim) 10%, transparent) 75%);
}

.item-detail-header:not(.item-detail-header-covered) .item-detail-shade {
  opacity: .25;
}

.item-detail-header-covered.item-detail-header-summary .item-detail-shade {
  display: none;
}

.item-detail-overlay {
  width: 100%;
  min-width: 0;
}

.item-detail-header-summary .item-detail-overlay {
  min-height: var(--cover-min-height, 0);
  display: flex;
  flex-direction: column;
}

.item-detail-header-covered.item-detail-header-summary .item-detail-overlay {
  grid-area: 1 / 1;
}

.item-detail-content {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 18px 20px;
}

.item-detail-header-summary .item-detail-content {
  padding-bottom: 10px;
}

.item-detail-summary {
  padding: 0 20px 24px;
}

.item-detail-header-summary .item-detail-summary {
  flex: 1;
  min-height: min-content;
  display: flex;
}

.item-detail-icon {
  flex: none;
  filter: drop-shadow(0 2px 7px color-mix(in srgb, var(--scrim) 68%, transparent));
}

.item-detail-title {
  min-width: 0;
}

.item-detail-header-covered.item-detail-header-summary .item-detail-title {
  width: fit-content;
  max-width: 100%;
  padding: 7px 10px;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 14%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--scrim) 68%, transparent);
  backdrop-filter: blur(4px);
  box-sizing: border-box;
}

.item-detail-title h1 {
  margin: 0;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: clamp(20px, 3vw, 28px);
  font-weight: 700;
  line-height: 1.1;
  text-shadow: 0 2px 12px var(--scrim);
}

.item-detail-title span {
  display: block;
  margin-top: 4px;
  color: color-mix(in srgb, var(--text-1) 72%, transparent);
  font-size: 12px;
  text-shadow: 0 1px 8px var(--scrim);
}

.item-detail-custom {
  align-self: flex-end;
  padding-bottom: 3px;
  color: var(--accent);
  font-size: 10px;
}

.item-detail-controls {
  flex: none;
  align-self: flex-start;
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  max-width: 100%;
}

.item-detail-actions,
.item-detail-corner {
  display: flex;
  align-items: center;
}

.item-detail-corner {
  flex: none;
}

@media (max-width: 760px) {
  .item-detail-header {
    margin: -14px -16px 14px;
  }

  .item-detail-summary {
    padding-right: 16px;
    padding-left: 16px;
  }
}

@media (max-width: 520px) {
  .item-detail-header {
    margin: -12px -12px 14px;
  }

  .item-detail-content {
    align-items: flex-end;
    flex-wrap: wrap;
    padding: 16px 14px;
  }

  .item-detail-summary {
    padding-right: 14px;
    padding-bottom: 18px;
    padding-left: 14px;
  }

  .item-detail-title {
    flex: 1;
  }

  .item-detail-header-summary .item-detail-title {
    flex: 0 1 auto;
  }

  .item-detail-controls {
    margin-left: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .item-detail-cover-entering {
    animation: none;
  }
}
</style>
