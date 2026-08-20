<template>
  <ObjectListItem :item="item" :type="type" :name-en="item.nameEn || ''" :custom="item.userId != null" :subtitle="subtitle">
    <template v-if="firstAttack" #metric>
      <WeaponDamageMetric :attack="firstAttack" :size="36" />
    </template>
    <template v-if="costLabel" #trailing><span class="wli-cost">{{ costLabel }}</span></template>
  </ObjectListItem>
</template>

<script setup>
import { computed } from 'vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem'
import WeaponDamageMetric from '@/features/items/components/WeaponDamageMetric.vue'
import { useSchemaSuggests } from '@/features/handbook/objects/lib/useSchemaSuggests'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const { suggestItems } = useSchemaSuggests(() => props.type)

const damageTypeMap = computed(() => Object.fromEntries(suggestItems('type').map(s => [s.id, s.value])))
const tagMap = computed(() => Object.fromEntries(suggestItems('tags').map(s => [s.id, s.value])))

const data = computed(() => props.item.data || {})
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
const firstAttack = computed(() => Array.isArray(data.value.attacks) ? data.value.attacks[0] : null)

const damageType = computed(() => firstAttack.value
  ? (damageTypeMap.value[firstAttack.value.type] || firstAttack.value.type || '')
  : '')

const tagLabels = computed(() =>
  (Array.isArray(data.value.tags) ? data.value.tags : [])
    .map(id => tagMap.value[id] || String(id))
    .filter(Boolean)
)

const subtitle = computed(() => {
  const parts = [damageType.value, ...tagLabels.value].filter(Boolean)
  return parts.join(' · ')
})

</script>

<style scoped>
.wli-cost { color: var(--text-2); font-size: 11px; white-space: nowrap; }

</style>
