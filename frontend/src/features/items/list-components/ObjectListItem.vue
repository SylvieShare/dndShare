<template>
  <div class="oli">
    <div class="oli-icon">
      <slot name="icon">
        <ItemIcon
          v-if="hasResolvedIcon"
          :item="item"
          :type="type"
          :fallback-to-type="iconFallbackToType"
          :size="resolvedIconSize"
        />
        <slot v-else name="icon-fallback" />
      </slot>
    </div>

    <div v-if="$slots.metric" class="oli-metric">
      <slot name="metric" />
    </div>

    <div class="oli-main">
      <div class="oli-name-row" :class="{ 'oli-name-row--center': nameCenter }">
        <span class="oli-name">{{ item.name }}</span>
        <span v-if="nameEn" class="oli-name-en">{{ nameEnFormatted }}</span>
        <span v-if="custom" class="oli-custom" title="Ваш объект">✦</span>
        <slot name="name-extras" />
      </div>
      <div v-if="$slots.subtitle || subtitle" class="oli-sub">
        <slot name="subtitle">{{ subtitle }}</slot>
      </div>
    </div>

    <div class="oli-right">
      <slot name="trailing" />
      <svg class="oli-chevron" viewBox="0 0 16 16" fill="none" width="14" height="14">
        <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'

// Shared row shell for handbook object lists. The stable order is icon, optional
// metric, two-line identity, then trailing metadata and the disclosure chevron.
const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
  nameEn: { type: String, default: '' },
  custom: { type: Boolean, default: false },
  subtitle: { type: String, default: '' },
  nameCenter: { type: Boolean, default: false },
  iconFallbackToType: { type: Boolean, default: true },
})

const hasResolvedIcon = computed(() => !!(
  props.item?.iconImageUrl
  || props.item?.svg
  || (props.iconFallbackToType && props.type?.svg)
))
const resolvedIconSize = computed(() => props.item?.iconImageUrl ? 64 : 22)

const nameEnFormatted = computed(() =>
  (props.nameEn || '')
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, ch => ch.toUpperCase())
)
</script>

<style scoped>
.oli {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  min-height: 64px;
}

.oli-icon {
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.oli-metric {
  width: 28px;
  flex: 0 0 28px;
  display: grid;
  place-items: center;
  font-family: var(--font-ui);
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.oli-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.oli-name-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.oli-name-row--center { align-items: center; }

.oli-name {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.oli-name-en {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
}

.oli-custom {
  color: var(--accent);
  font-size: 8px;
  flex-shrink: 0;
}

.oli-sub {
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oli-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.oli-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
