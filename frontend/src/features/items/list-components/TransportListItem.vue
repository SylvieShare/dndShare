<template>
  <ObjectListItem :item="item" :type="type" :name-en="item.nameEn || ''" :custom="item.userId != null" :subtitle="subtitle">
    <template #metric>
      <span class="transport-list-metric">
        <small>{{ movement.value != null ? 'ХОД' : 'ВЕС' }}</small>
        {{ metricValue }}
      </span>
    </template>
    <template v-if="costLabel" #trailing><span class="transport-list-cost">{{ costLabel }}</span></template>
  </ObjectListItem>
</template>

<script setup>
import { computed } from 'vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'

const props = defineProps({ item: { type: Object, required: true }, type: { type: Object, default: null } })
const CATEGORY = { mount: 'Скакун', tack: 'Сёдла и упряжь', land_vehicle: 'Наземный', water_vehicle: 'Водный' }
const TACK = { feed: 'Корм', storage: 'Груз', military_saddle: 'Боевое седло', pack_saddle: 'Грузовое седло', riding_saddle: 'Ездовое седло', exotic_saddle: 'Экзотическое седло', control: 'Управление' }
const PROPULSION = { self: 'Собственный ход', drawn: 'Тяга', sail: 'Парус', oar: 'Вёсла', sail_or_oar: 'Парус/вёсла' }
const data = computed(() => props.item.data || {})
const movement = computed(() => data.value.movement || {})
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
const metricValue = computed(() => movement.value.value != null ? String(movement.value.value).replace('.', ',') : (data.value.weight ?? '—'))
const subtitle = computed(() => [CATEGORY[data.value.category] || 'Транспорт', TACK[data.value.tack_kind], PROPULSION[data.value.propulsion], movement.value.unit === 'miles_per_hour' ? 'мили/ч' : (movement.value.value != null ? 'фт.' : null)].filter(Boolean).join(' · '))
</script>

<style scoped>
.transport-list-metric { min-width: 39px; display: flex; flex-direction: column; align-items: center; color: var(--text-1); font-size: 18px; font-variant-numeric: tabular-nums; font-weight: 800; line-height: 1; }
.transport-list-metric small { margin-bottom: 3px; color: var(--text-muted); font-size: 7px; letter-spacing: .1em; }
.transport-list-cost { color: var(--text-2); font-size: 11px; white-space: nowrap; }
</style>
