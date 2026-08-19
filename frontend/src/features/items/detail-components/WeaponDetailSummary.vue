<template>
  <div class="weapon-summary">
    <div class="weapon-summary-grid">
      <div class="weapon-summary-side weapon-summary-left">
        <div class="weapon-stat weapon-stat-primary">
          <span class="weapon-stat-label"><Swords :size="13" aria-hidden="true" /> Урон</span>
          <strong>{{ mainDamage }}</strong>
          <span>{{ mainDamageType }}</span>
        </div>
        <div v-if="versatileDamage" class="weapon-stat">
          <span class="weapon-stat-label"><MoveDiagonal2 :size="13" aria-hidden="true" /> Двумя руками</span>
          <strong>{{ versatileDamage }}</strong>
        </div>
        <div class="weapon-stat">
          <span class="weapon-stat-label"><Badge :size="13" aria-hidden="true" /> Категория</span>
          <strong class="weapon-stat-compact">{{ categoryLabel }}</strong>
          <span>{{ data.is_long_range ? 'дальнобойное' : 'ближний бой' }}</span>
        </div>
      </div>

      <div class="weapon-cover-safe-zone" aria-hidden="true"></div>

      <div class="weapon-summary-side weapon-summary-right">
        <div v-if="rangeLabel" class="weapon-stat">
          <span class="weapon-stat-label"><Crosshair :size="13" aria-hidden="true" /> Дистанция</span>
          <strong class="weapon-stat-compact">{{ rangeLabel }}</strong>
        </div>
        <div v-if="costLabel" class="weapon-stat">
          <span class="weapon-stat-label"><Coins :size="13" aria-hidden="true" /> Стоимость</span>
          <strong class="weapon-stat-compact">{{ costLabel }}</strong>
        </div>
        <div v-if="data.weight != null" class="weapon-stat">
          <span class="weapon-stat-label"><Weight :size="13" aria-hidden="true" /> Вес</span>
          <strong>{{ data.weight }}</strong>
          <span>фунт.</span>
        </div>
      </div>

      <div class="weapon-rules">
        <div class="weapon-rule weapon-rule-proficiency">
          <BadgeCheck :size="15" aria-hidden="true" />
          <span><small>Подходящее владение · любое</small>{{ proficiencyLabel }}</span>
        </div>
        <div class="weapon-rule">
          <Tags :size="15" aria-hidden="true" />
          <span><small>Свойства</small>{{ propertiesLabel }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Badge, BadgeCheck, Coins, Crosshair, MoveDiagonal2, Swords, Tags, Weight } from '@lucide/vue'
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

<style scoped src="./styles/WeaponDetailSummary.css"></style>
