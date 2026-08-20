<template>
  <div class="armor-summary">
    <CoverSummaryLayout :safe-min-height="210">
      <template #left>
        <CoverStatCard :icon="ShieldCheck" label="Класс доспеха" :value="armorValue" :note="armorNote" tone="accent" />
        <CoverStatCard :icon="Layers3" label="Категория" :value="categoryLabel" size="compact" />
      </template>

      <template #right>
        <CoverStatCard v-if="costLabel" :icon="Coins" label="Стоимость" :value="costLabel" size="compact" />
        <CoverStatCard v-if="data.weight != null" :icon="Weight" label="Вес" :value="data.weight" note="фунт." />
      </template>

      <template #bottom>
        <CoverSummaryRail :columns="3">
          <CoverSummaryRailItem :icon="BadgeCheck" label="Владение">{{ proficiencyLabel }}</CoverSummaryRailItem>
          <CoverSummaryRailItem :icon="Dumbbell" label="Сила">{{ strengthLabel }}</CoverSummaryRailItem>
          <CoverSummaryRailItem :icon="EyeOff" label="Скрытность">{{ stealthLabel }}</CoverSummaryRailItem>
        </CoverSummaryRail>
      </template>
    </CoverSummaryLayout>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BadgeCheck, Coins, Dumbbell, EyeOff, Layers3, ShieldCheck, Weight } from '@lucide/vue'
import CoverStatCard from '@/features/items/components/cover/CoverStatCard.vue'
import CoverSummaryLayout from '@/features/items/components/cover/CoverSummaryLayout.vue'
import CoverSummaryRail from '@/features/items/components/cover/CoverSummaryRail.vue'
import CoverSummaryRailItem from '@/features/items/components/cover/CoverSummaryRailItem.vue'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  item: { type: Object, required: true },
})

const CATEGORY_LABELS = {
  light: 'Лёгкий',
  medium: 'Средний',
  heavy: 'Тяжёлый',
  shield: 'Щит',
}

const suggestStore = useSuggestStore()
suggestStore.ensure(3)

const data = computed(() => props.item.data || {})
const armor = computed(() => data.value.armor || {})
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
const categoryLabel = computed(() => CATEGORY_LABELS[data.value.category] || 'Доспех')
const proficiencyLabel = computed(() => {
  const id = data.value.required_armor_proficiency
  return suggestStore.items(3).find(row => row.id === id)?.value || 'Не указано'
})
const armorValue = computed(() => armor.value.shield ? `+${armor.value.shield_bonus ?? 2}` : (armor.value.ac ?? '—'))
const armorNote = computed(() => {
  if (armor.value.shield) return 'бонус к КД'
  if (!armor.value.use_dex) return 'без Ловкости'
  if (armor.value.dex_cap != null) return `+ ЛОВ, максимум +${armor.value.dex_cap}`
  return '+ модификатор ЛОВ'
})
const strengthLabel = computed(() => data.value.strength_required != null ? `${data.value.strength_required}+` : 'Без требования')
const stealthLabel = computed(() => data.value.stealth_disadvantage ? 'Помеха' : 'Без помехи')
</script>

<style scoped>
.armor-summary { flex: 1; width: 100%; display: flex; }
</style>
