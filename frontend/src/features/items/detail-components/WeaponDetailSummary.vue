<template>
  <div class="weapon-summary">
    <CoverSummaryLayout>
      <template #left>
        <CoverStatCard :icon="Swords" label="Урон" :value="mainDamage" :note="mainDamageType" tone="danger" />
        <CoverStatCard v-if="versatileDamage" :icon="MoveDiagonal2" label="Двумя руками" :value="versatileDamage" />
        <CoverStatCard
          :icon="Badge"
          label="Категория"
          :value="categoryLabel"
          :note="data.is_long_range ? 'дальнобойное' : 'ближний бой'"
          size="compact"
        />
      </template>

      <template #right>
        <CoverStatCard v-if="rangeLabel" :icon="Crosshair" label="Дистанция" :value="rangeLabel" size="compact" />
        <CoverStatCard v-if="costLabel" :icon="Coins" label="Стоимость" :value="costLabel" size="compact" />
        <CoverStatCard v-if="data.weight != null" :icon="Weight" label="Вес" :value="data.weight" note="фунт." />
      </template>

      <template #bottom>
        <CoverSummaryRail columns="1.35fr 1fr">
          <CoverSummaryRailItem :icon="BadgeCheck" label="Подходящее владение · любое">
            {{ proficiencyLabel }}
          </CoverSummaryRailItem>
          <CoverSummaryRailItem :icon="Tags" label="Свойства">{{ propertiesLabel }}</CoverSummaryRailItem>
        </CoverSummaryRail>
      </template>
    </CoverSummaryLayout>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Badge, BadgeCheck, Coins, Crosshair, MoveDiagonal2, Swords, Tags, Weight } from '@lucide/vue'
import CoverStatCard from '@/features/items/components/cover/CoverStatCard.vue'
import CoverSummaryLayout from '@/features/items/components/cover/CoverSummaryLayout.vue'
import CoverSummaryRail from '@/features/items/components/cover/CoverSummaryRail.vue'
import CoverSummaryRailItem from '@/features/items/components/cover/CoverSummaryRailItem.vue'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'
import { diceById } from '@/shared/lib/systemDice'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  item: { type: Object, required: true },
})

const suggestStore = useSuggestStore()
suggestStore.ensure(4)
suggestStore.ensure(12)
suggestStore.ensure(14)

const data = computed(() => props.item.data || {})
const attacks = computed(() => Array.isArray(data.value.attacks) ? data.value.attacks : [])
const versatileAttacks = computed(() => Array.isArray(data.value.universe_attacks) ? data.value.universe_attacks : [])
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
const categoryLabel = computed(() => data.value.is_military ? 'Воинское' : (props.item.name === 'Безоружный удар' ? 'Без оружия' : 'Простое'))
const mainDamage = computed(() => attacks.value.length ? damageFormula(attacks.value[0]) : 'Особое')
const versatileDamage = computed(() => versatileAttacks.value.length ? damageFormula(versatileAttacks.value[0]) : '')
const mainDamageType = computed(() => {
  const typeId = attacks.value[0]?.type
  return suggestStore.items(12).find(row => row.id === typeId)?.value || (attacks.value.length ? 'урон' : 'без урона')
})
const rangeLabel = computed(() => {
  const min = data.value.range_min
  const max = data.value.range_max
  if (min == null && max == null) return ''
  if (min != null && max != null) return `${min}/${max} фт.`
  return `${min ?? max} фт.`
})
const proficiencyLabel = computed(() => {
  const ids = Array.isArray(data.value.required_weapon_proficiencies)
    ? data.value.required_weapon_proficiencies
    : []
  const labels = ids
    .map(id => suggestStore.items(4).find(row => row.id === id)?.value)
    .filter(Boolean)
  return labels.length ? labels.join(' или ') : 'Владеют все'
})
const propertiesLabel = computed(() => {
  const labels = (Array.isArray(data.value.tags) ? data.value.tags : [])
    .map(id => suggestStore.items(14).find(row => row.id === id)?.value)
    .filter(Boolean)
  return labels.length ? labels.join(' · ') : 'Нет особых свойств'
})

function damageFormula(attack) {
  const count = Number(attack?.count) || 1
  const dice = diceById(attack?.dice_id)
  return dice ? `${count}${dice.value}` : String(count)
}
</script>

<style scoped>
.weapon-summary { flex: 1; width: 100%; display: flex; }
</style>
