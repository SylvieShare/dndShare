<template>
  <header
    class="item-detail-header"
    :class="{ 'item-detail-header-covered': hasCover }"
    :style="coverStyle"
  >
    <img
      v-if="hasCover"
      class="item-detail-cover"
      :src="item.coverImageUrl"
      alt=""
      aria-hidden="true"
      @load="onCoverLoad"
      @error="coverFailed = true"
    />
    <div class="item-detail-shade" aria-hidden="true"></div>

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
  </header>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'

const props = defineProps({
  item: { type: Object, required: true },
})

const coverFailed = ref(false)
const coverAspectRatio = ref('4 / 1')
const hasCover = computed(() => Boolean(props.item.coverImageUrl) && !coverFailed.value)
const coverStyle = computed(() => hasCover.value
  ? { '--cover-aspect-ratio': coverAspectRatio.value }
  : {})
const formattedNameEn = computed(() => String(props.item.nameEn || '')
  .replace(/_/g, ' ')
  .replace(/\b[a-z]/g, char => char.toUpperCase()))

watch(() => props.item.coverImageUrl, () => {
  coverFailed.value = false
  coverAspectRatio.value = '4 / 1'
})

function onCoverLoad(event) {
  const width = event.currentTarget?.naturalWidth
  const height = event.currentTarget?.naturalHeight
  if (width > 0 && height > 0) coverAspectRatio.value = `${width} / ${height}`
}
</script>

<style scoped>
.item-detail-header {
  position: relative;
  isolation: isolate;
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
  min-height: 0;
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

.item-detail-shade {
  z-index: -1;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--scrim) 92%, transparent) 0%, color-mix(in srgb, var(--scrim) 42%, transparent) 60%, color-mix(in srgb, var(--scrim) 18%, transparent) 100%),
    linear-gradient(0deg, var(--scrim) 0%, color-mix(in srgb, var(--scrim) 10%, transparent) 75%);
}

.item-detail-header:not(.item-detail-header-covered) .item-detail-shade {
  opacity: .25;
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

  .item-detail-title {
    flex: 1;
  }

  .item-detail-actions {
    width: 100%;
    margin-left: 0;
  }
}
</style>
