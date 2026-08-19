<template>
  <div class="transport-summary">
    <div class="transport-summary-grid">
      <div class="transport-summary-side transport-summary-left">
        <div class="transport-stat transport-stat-primary">
          <span class="transport-stat-label"><component :is="categoryIcon" :size="13" aria-hidden="true" /> {{ primaryLabel }}</span>
          <strong>{{ primaryValue }}</strong>
          <span>{{ primaryNote }}</span>
        </div>
        <div class="transport-stat">
          <span class="transport-stat-label"><Shapes :size="13" aria-hidden="true" /> Категория</span>
          <strong class="transport-stat-compact">{{ categoryLabel }}</strong>
        </div>
      </div>

      <div class="transport-cover-safe-zone" aria-hidden="true"></div>

      <div class="transport-summary-side transport-summary-right">
        <div v-if="costLabel" class="transport-stat">
          <span class="transport-stat-label"><Coins :size="13" aria-hidden="true" /> Стоимость</span>
          <strong class="transport-stat-compact">{{ costLabel }}</strong>
        </div>
        <div v-if="data.weight != null" class="transport-stat">
          <span class="transport-stat-label"><Weight :size="13" aria-hidden="true" /> Вес</span>
          <strong>{{ data.weight }}</strong>
          <span>фунт.</span>
        </div>
      </div>

      <div class="transport-operations">
        <div class="transport-operation">
          <Waves v-if="movement.mode === 'water'" :size="15" aria-hidden="true" />
          <Route v-else :size="15" aria-hidden="true" />
          <span><small>Движение</small>{{ movementLabel || 'Не указано' }}</span>
        </div>
        <div class="transport-operation">
          <PackageOpen :size="15" aria-hidden="true" />
          <span><small>Вместимость</small>{{ capacityLabel }}</span>
        </div>
        <div class="transport-operation">
          <Link2 :size="15" aria-hidden="true" />
          <span><small>{{ relationTitle }}</small>{{ relationLabel }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { CarFront, Coins, Dog, Link2, PackageOpen, Route, Shapes, ShipWheel, Waves, Weight, Wrench } from '@lucide/vue'
import { ensureItemNames, itemName } from '@/features/handbook/objects/lib/itemNames'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'

const props = defineProps({ item: { type: Object, required: true } })

const CATEGORY = {
  mount: { label: 'Скакун', icon: Dog },
  tack: { label: 'Сёдла и упряжь', icon: Wrench },
  land_vehicle: { label: 'Наземный транспорт', icon: CarFront },
  water_vehicle: { label: 'Водный транспорт', icon: ShipWheel },
}
const TACK_LABELS = {
  feed: 'Корм', storage: 'Перевозка груза', military_saddle: 'Боевое седло',
  pack_saddle: 'Грузовое седло', riding_saddle: 'Ездовое седло',
  exotic_saddle: 'Экзотическое седло', control: 'Управление',
}

const data = computed(() => props.item.data || {})
const movement = computed(() => data.value.movement || {})
const capacity = computed(() => data.value.capacity || {})
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
const categoryLabel = computed(() => CATEGORY[data.value.category]?.label || 'Транспорт')
const categoryIcon = computed(() => CATEGORY[data.value.category]?.icon || CarFront)
const movementLabel = computed(() => formatMovement(movement.value))
const primaryLabel = computed(() => movementLabel.value ? 'Скорость' : (data.value.weight != null ? 'Вес' : 'Тип'))
const primaryValue = computed(() => movementLabel.value || (data.value.weight != null ? data.value.weight : categoryLabel.value))
const primaryNote = computed(() => movementLabel.value ? movementModeLabel(movement.value.mode) : (data.value.weight != null ? 'фунт.' : ''))
const capacityLabel = computed(() => {
  const c = capacity.value
  if (c.carrying_lb != null) return `${c.carrying_lb} фнт.`
  if (c.cargo_tons != null) return `${c.cargo_tons} т`
  if (c.cargo_lb != null) return `${c.cargo_lb} фнт.`
  if (c.passengers != null) return `${c.passengers} пасс.`
  return 'Не указана'
})
const relationTitle = computed(() => data.value.category === 'mount' ? 'Бестиарий' : (data.value.category === 'tack' ? 'Назначение' : 'Привод'))
const relationLabel = computed(() => {
  if (data.value.creature_item_id) return itemName(data.value.creature_item_id) || `#${data.value.creature_item_id}`
  if (data.value.tack_kind) return TACK_LABELS[data.value.tack_kind] || data.value.tack_kind
  return propulsionLabel(data.value.propulsion) || 'Не указан'
})

watch(() => data.value.creature_item_id, id => id && ensureItemNames([id]), { immediate: true })

function formatMovement(value) {
  if (value.value == null) return ''
  const number = String(value.value).replace('.', ',')
  return value.unit === 'miles_per_hour' ? `${number} мили/ч` : `${number} фт.`
}
function movementModeLabel(mode) { return ({ ground: 'по земле', water: 'по воде', air: 'по воздуху' })[mode] || '' }
function propulsionLabel(value) { return ({ self: 'Собственный ход', drawn: 'Тяга скакунов', sail: 'Парус', oar: 'Вёсла', sail_or_oar: 'Парус или вёсла' })[value] || '' }
</script>

<style scoped src="./styles/TransportDetailSummary.css"></style>
