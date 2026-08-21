<template>
  <template v-if="hasDetails">
    <span v-if="usesLabel" class="atd-uses">{{ usesLabel }}</span>
    <span v-if="data.rollback_short_rest" class="atd-badge atd-sr">КО</span>
    <span v-if="data.rollback_long_rest" class="atd-badge atd-lr">ДО</span>
  </template>
</template>

<script setup>
import { computed } from 'vue'
import { abilityUseTotal } from '@/shared/lib/dndAbilityUses'
import { STAT_FULL, SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'

const props = defineProps({
  item: { type: Object, required: true },
  values: { type: Object, default: () => ({}) },
})

const data = computed(() => props.item.data || {})
const usesLabel = computed(() => {
  const total = abilityUseTotal(data.value, props.values)
  if (total == null) return ''
  const stat = SUGGEST16_TO_STAT[Number(data.value.max_use_stat)]
  if (!stat) return `${total} исп.`
  const minimum = data.value.max_use_min == null ? 1 : Math.max(0, Number(data.value.max_use_min) || 0)
  return `${total} исп. · модификатор ${STAT_FULL[stat].toLowerCase()}, минимум ${minimum}`
})
const hasDetails = computed(() => usesLabel.value || data.value.rollback_short_rest || data.value.rollback_long_rest)
</script>

<style scoped>
.atd-uses {
  font-size: 11px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  border-radius: 4px;
  padding: 2px 7px;
}

.atd-badge {
  font-size: 9px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
}
.atd-sr { background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); }
.atd-lr { background: color-mix(in srgb, var(--info) 15%, transparent); color: var(--info); }
</style>
