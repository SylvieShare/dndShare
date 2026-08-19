<template>
  <div class="transport-detail-content">
    <DetailSection v-if="data.desc" label="Описание">
      <RichContent class="transport-description" :html="data.desc" :actor-name="actorName || item.name" />
    </DetailSection>

    <DetailSection label="Эксплуатация">
      <div class="transport-rules">
        <div class="transport-rule">
          <span>Передвижение</span>
          <strong>{{ movementLabel || 'Зависит от скакуна' }}</strong>
          <small>{{ propulsionText }}</small>
        </div>
        <div class="transport-rule">
          <span>Вместимость</span>
          <strong>{{ capacityTitle }}</strong>
          <small>{{ capacityText }}</small>
        </div>
        <div class="transport-rule">
          <span>{{ relationTitle }}</span>
          <strong>{{ relationLabel }}</strong>
          <small>{{ relationText }}</small>
        </div>
      </div>
    </DetailSection>

    <DetailSection v-if="hasVehicleStats" label="Характеристики объекта">
      <div class="transport-object-stats">
        <div v-if="vehicleStats.ac != null"><span>КД</span><strong>{{ vehicleStats.ac }}</strong></div>
        <div v-if="vehicleStats.hp != null"><span>Хиты</span><strong>{{ vehicleStats.hp }}</strong></div>
        <div v-if="vehicleStats.damage_threshold != null"><span>Порог урона</span><strong>{{ vehicleStats.damage_threshold }}</strong></div>
      </div>
    </DetailSection>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { ensureItemNames, itemName } from '@/features/handbook/objects/lib/itemNames'
import DetailSection from '@/shared/ui/DetailSection.vue'
import RichContent from '@/shared/ui/DndRichContent.vue'

const props = defineProps({
  item: { type: Object, required: true },
  actorName: { type: String, default: '' },
})
const data = computed(() => props.item.data || {})
const movement = computed(() => data.value.movement || {})
const capacity = computed(() => data.value.capacity || {})
const vehicleStats = computed(() => data.value.vehicle_stats || {})
const hasVehicleStats = computed(() => Object.values(vehicleStats.value).some(value => value != null && value !== ''))
const movementLabel = computed(() => {
  if (movement.value.value == null) return ''
  const value = String(movement.value.value).replace('.', ',')
  return movement.value.unit === 'miles_per_hour' ? `${value} мили/ч` : `${value} фт.`
})
const propulsionText = computed(() => ({ self: 'Собственный ход.', drawn: 'Скорость определяется выбранными тягловыми существами.', sail: 'Движение под парусом.', oar: 'Движение на вёслах.', sail_or_oar: 'Можно идти под парусом или на вёслах.' })[data.value.propulsion] || 'Способ движения не указан.')
const capacityTitle = computed(() => {
  const c = capacity.value
  if (c.carrying_lb != null) return `${c.carrying_lb} фнт.`
  if (c.cargo_tons != null) return `${c.cargo_tons} тонн`
  if (c.cargo_lb != null) return `${c.cargo_lb} фнт.`
  return 'Не указана'
})
const capacityText = computed(() => {
  const c = capacity.value
  const parts = []
  if (c.crew != null) parts.push(`экипаж ${c.crew}`)
  if (c.passengers != null) parts.push(`пассажиры ${c.passengers}`)
  return parts.length ? parts.join(' · ') : 'Дополнительные места и экипаж источником не заданы.'
})
const relationTitle = computed(() => data.value.category === 'mount' ? 'Связанное существо' : (data.value.category === 'tack' ? 'Правило снаряжения' : 'Состояние данных'))
const relationLabel = computed(() => {
  if (data.value.creature_item_id) return itemName(data.value.creature_item_id) || `#${data.value.creature_item_id}`
  if (data.value.rider_stability_advantage) return 'Устойчивое боевое седло'
  if (data.value.for_exotic_mount) return 'Экзотический скакун'
  return 'Базовая запись PHB'
})
const relationText = computed(() => {
  if (data.value.creature_item_id) return 'Полные характеристики доступны в бестиарии и не дублируются здесь.'
  if (data.value.rider_stability_advantage) return 'Даёт преимущество на спасброски, чтобы остаться в седле.'
  if (data.value.for_exotic_mount) return 'Форма седла подбирается для водного или летающего скакуна.'
  return 'Неизвестные боевые параметры оставлены пустыми, а не выдуманы.'
})
watch(() => data.value.creature_item_id, id => id && ensureItemNames([id]), { immediate: true })
</script>

<style scoped>
.transport-detail-content { display: flex; flex-direction: column; gap: 18px; }
.transport-description { color: var(--text-1); font-size: 14px; line-height: 1.65; }
.transport-rules { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.transport-rule { min-width: 0; display: flex; flex-direction: column; gap: 5px; padding: 13px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.transport-rule > span, .transport-object-stats span { color: var(--text-muted); font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.transport-rule > strong { color: var(--text-1); font-size: 15px; line-height: 1.25; }
.transport-rule > small { color: var(--text-2); font-size: 11px; line-height: 1.45; }
.transport-object-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.transport-object-stats > div { display: flex; flex-direction: column; gap: 5px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.transport-object-stats strong { color: var(--text-1); font-size: 22px; }
@media (max-width: 760px) { .transport-rules, .transport-object-stats { grid-template-columns: 1fr; } }
</style>
