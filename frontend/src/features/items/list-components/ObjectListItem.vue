<template>
  <div class="oli" :style="{ gap: gap + 'px' }">
    <slot name="leading" />

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

// Shared row shell for handbook object lists (items/weapons/spells/potions/enemies).
// Each object type wraps this and fills the #leading / #trailing / #name-extras
// slots with its own icon and badges; the name row, subtitle and chevron are common.
const props = defineProps({
  item: { type: Object, required: true },
  gap: { type: Number, default: 8 },
  nameEn: { type: String, default: '' },
  custom: { type: Boolean, default: false },
  subtitle: { type: String, default: '' },
  nameCenter: { type: Boolean, default: false },
})

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
  width: 100%;
  min-width: 0;
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
