<template>
  <header
    ref="headerElement"
    class="item-detail-header"
    :class="{
      'item-detail-header-covered': hasCover,
      'item-detail-header-tall-cover': coverHeightLimited,
      'item-detail-header-summary': $slots.summary,
    }"
    :data-item-type-id="type?.id || undefined"
    :style="coverStyle"
  >
    <img
      v-if="hasCover"
      class="item-detail-cover"
      :src="item.coverImageUrl"
      alt=""
      aria-hidden="true"
      @load="onCoverLoad"
      @error="onCoverError"
    />
    <div class="item-detail-shade" aria-hidden="true"></div>

    <div class="item-detail-overlay">
      <div class="item-detail-content">
        <ItemIcon
          v-if="item.iconImageUrl || item.svg"
          class="item-detail-icon"
          :item="item"
          :fallback-to-type="false"
          :size="42"
        />
        <div class="item-detail-title">
          <h1>{{ item.name }}</h1>
          <span v-if="formattedNameEn">{{ formattedNameEn }}</span>
        </div>
        <span v-if="item.userId != null" class="item-detail-custom">✦ ваше</span>
        <div class="item-detail-actions">
          <span class="item-detail-id">ID {{ item.id }}</span>
          <slot name="actions" />
        </div>
      </div>

      <div v-if="$slots.summary" class="item-detail-summary">
        <slot name="summary" />
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const TYPE_COVER_STYLES = {
  6: {
    '--cover-min-height': '440px',
    '--cover-max-height': 'none',
  },
}

const coverFailed = ref(false)
const coverAspectRatio = ref('4 / 1')
const coverHeightLimited = ref(false)
const coverNaturalSize = ref(null)
const headerElement = ref(null)
const hasCover = computed(() => Boolean(props.item.coverImageUrl) && !coverFailed.value)
const coverStyle = computed(() => ({
  ...(TYPE_COVER_STYLES[props.type?.id] || {}),
  ...(hasCover.value ? { '--cover-aspect-ratio': coverAspectRatio.value } : {}),
}))
const formattedNameEn = computed(() => String(props.item.nameEn || '')
  .replace(/_/g, ' ')
  .replace(/\b[a-z]/g, char => char.toUpperCase()))

watch(() => props.item.coverImageUrl, () => {
  coverFailed.value = false
  coverAspectRatio.value = '4 / 1'
  coverHeightLimited.value = false
  coverNaturalSize.value = null
})

function onCoverLoad(event) {
  const width = event.currentTarget?.naturalWidth
  const height = event.currentTarget?.naturalHeight
  if (width > 0 && height > 0) {
    coverAspectRatio.value = `${width} / ${height}`
    coverNaturalSize.value = { width, height }
    nextTick(updateCoverLayout)
  }
}

function onCoverError() {
  coverFailed.value = true
  coverHeightLimited.value = false
  coverNaturalSize.value = null
}

function updateCoverLayout() {
  const header = headerElement.value
  const size = coverNaturalSize.value
  if (!header || !size || !hasCover.value) {
    coverHeightLimited.value = false
    return
  }
  const intrinsicHeight = header.clientWidth * size.height / size.width
  coverHeightLimited.value = intrinsicHeight > header.clientHeight + 1
}

let resizeObserver
onMounted(() => {
  resizeObserver = new ResizeObserver(updateCoverLayout)
  if (headerElement.value) resizeObserver.observe(headerElement.value)
  window.visualViewport?.addEventListener('resize', updateCoverLayout)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.visualViewport?.removeEventListener('resize', updateCoverLayout)
})
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
  aspect-ratio: var(--cover-aspect-ratio, 4 / 1);
  max-height: min(320px, 42dvh);
  min-height: 0;
}

.item-detail-header-summary {
  min-height: var(--cover-min-height, 0);
  align-items: stretch;
}

.item-detail-header-covered.item-detail-header-summary {
  aspect-ratio: auto;
  min-height: var(--cover-min-height, 440px);
  max-height: var(--cover-max-height, none);
}

.item-detail-header-covered .item-detail-title h1 {
  color: var(--text-on-accent);
}

.item-detail-header-covered .item-detail-title span,
.item-detail-header-covered .item-detail-id {
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

.item-detail-header-tall-cover .item-detail-cover {
  object-position: center top;
}

.item-detail-header-tall-cover:not(.item-detail-header-summary) .item-detail-content {
  background: color-mix(in srgb, var(--scrim) 62%, transparent);
  backdrop-filter: blur(2px);
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

.item-detail-overlay {
  width: 100%;
  min-width: 0;
}

.item-detail-header-summary .item-detail-overlay {
  min-height: inherit;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.item-detail-header-covered.item-detail-header-summary .item-detail-overlay {
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--scrim) 72%, transparent), color-mix(in srgb, var(--scrim) 36%, transparent) 68%, color-mix(in srgb, var(--scrim) 18%, transparent)),
    linear-gradient(0deg, color-mix(in srgb, var(--scrim) 76%, transparent), color-mix(in srgb, var(--scrim) 8%, transparent) 92%);
  backdrop-filter: blur(1.5px);
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

.item-detail-icon {
  flex: none;
  filter: drop-shadow(0 2px 7px color-mix(in srgb, var(--scrim) 68%, transparent));
}

.item-detail-title {
  min-width: 0;
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

.item-detail-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.item-detail-id {
  color: color-mix(in srgb, var(--text-1) 62%, transparent);
  font-size: 11px;
  text-shadow: 0 1px 6px var(--scrim);
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

  .item-detail-actions {
    width: 100%;
    margin-left: 0;
  }
}
</style>
