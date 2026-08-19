<template>
  <ObjectListItem :item="item" :type="type" :name-en="item.nameEn || ''" :custom="item.userId != null" :subtitle="subtitle">
    <template #metric>
      <span class="armor-list-metric">
        <small>{{ armor.shield ? 'БОНУС' : 'КД' }}</small>
        {{ armor.shield ? `+${armor.shield_bonus ?? 2}` : (armor.ac ?? '—') }}
      </span>
    </template>
    <template v-if="costLabel" #trailing><span class="armor-list-cost">{{ costLabel }}</span></template>
  </ObjectListItem>
</template>

<script setup>
import { computed } from 'vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const CATEGORY_LABELS = { light: 'Лёгкий', medium: 'Средний', heavy: 'Тяжёлый', shield: 'Щит' }
const data = computed(() => props.item.data || {})
const armor = computed(() => data.value.armor || {})
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
const subtitle = computed(() => [
  CATEGORY_LABELS[data.value.category] || 'Доспех',
  data.value.weight != null ? `${data.value.weight} фн.` : null,
  data.value.stealth_disadvantage ? 'Помеха Скрытности' : null,
].filter(Boolean).join(' · '))
</script>

<style scoped>
.armor-list-metric { min-width: 34px; display: flex; flex-direction: column; align-items: center; color: var(--text-1); font-size: 19px; font-variant-numeric: tabular-nums; font-weight: 800; line-height: 1; }
.armor-list-metric small { margin-bottom: 3px; color: var(--text-muted); font-size: 7px; letter-spacing: .1em; }
.armor-list-cost { color: var(--text-2); font-size: 11px; white-space: nowrap; }
</style>
