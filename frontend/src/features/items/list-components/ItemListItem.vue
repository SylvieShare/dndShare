<template>
  <div class="ili">
    <SvgIcon
      v-if="type && type.svg"
      class="ili-icon"
      :svg="type.svg"
      :color="type.color"
    />
    <span v-else class="ili-icon-placeholder" aria-hidden="true"></span>

    <div class="ili-main">
      <div class="ili-name-row">
        <span class="ili-name">{{ item.name }}</span>
        <span v-if="item.nameEn" class="ili-name-en">{{ nameEnFormatted }}</span>
        <span v-if="item.userId != null" class="ili-custom" title="Ваш объект">✦</span>
      </div>
      <div v-if="subtitle" class="ili-sub">{{ subtitle }}</div>
    </div>

    <div class="ili-right">
      <span v-if="costLabel" class="ili-cost">{{ costLabel }}</span>
      <svg class="ili-chevron" viewBox="0 0 16 16" fill="none" width="14" height="14">
        <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SvgIcon from '@/shared/ui/SvgIcon'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const data = computed(() => props.item.data || {})
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))

const subtitle = computed(() => {
  const parts = [
    data.value.type || data.value.subtype,
    data.value.weight != null ? `${data.value.weight} фн.` : null,
    data.value.is_container ? 'Контейнер' : null,
    data.value.consumable ? 'Расходуемый' : null,
  ].filter(Boolean)
  return parts.join(' · ')
})

const nameEnFormatted = computed(() =>
  (props.item.nameEn || '')
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, ch => ch.toUpperCase())
)
</script>

<style scoped>
.ili {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.ili-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
}

.ili-icon-placeholder {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--border);
}

.ili-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ili-name-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.ili-name {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.ili-name-en {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
}

.ili-custom {
  color: var(--accent);
  font-size: 8px;
  flex-shrink: 0;
}

.ili-sub {
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ili-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.ili-cost {
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
}

.ili-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
