<template>
  <CoverSummaryLayout :safe-min-height="220">
    <template #left>
      <CoverStatCard label="Вид предмета" :value="data.type || 'Магический предмет'" size="compact" />
      <CoverStatCard label="Редкость" :value="magicItemRarity(data.rarity)" tone="accent" size="compact" />
      <CoverStatCard v-if="bonus" label="Магический бонус" :value="`+${bonus}`" :note="data.weapon ? 'к атаке и урону' : 'к КД'" />
    </template>
    <template #right>
      <CoverStatCard v-if="cost" label="Стоимость" :value="cost" size="compact" tone="warning" />
      <CoverStatCard v-if="data.weight != null" label="Вес" :value="`${data.weight} фунт.`" size="compact" />
      <CoverStatCard v-if="data.max_use != null" label="Зарядов" :value="data.manual_size ? 'Задаёт владелец' : data.max_use" size="compact" />
    </template>
    <template #bottom>
      <CoverSummaryRail :columns="2">
        <CoverSummaryRailItem label="Настройка">{{ magicAttunementLabel(data.attunement) }}<small v-if="data.attunement_requirement"> · {{ data.attunement_requirement }}</small></CoverSummaryRailItem>
        <CoverSummaryRailItem label="Свойства действуют">{{ data.activation === 'carried' ? 'В инвентаре' : 'При экипировке' }}<small v-if="data.level > 1"> · с уровня {{ data.level }}</small></CoverSummaryRailItem>
      </CoverSummaryRail>
    </template>
  </CoverSummaryLayout>
</template>
<script setup>
import { computed } from 'vue'
import CoverSummaryLayout from '@/features/items/components/cover/CoverSummaryLayout.vue'
import CoverStatCard from '@/features/items/components/cover/CoverStatCard.vue'
import CoverSummaryRail from '@/features/items/components/cover/CoverSummaryRail.vue'
import CoverSummaryRailItem from '@/features/items/components/cover/CoverSummaryRailItem.vue'
import { magicItemRarity, magicAttunementLabel } from '@/features/items/lib/magicItemPresentation'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'
const props = defineProps({ item: Object })
const data = computed(() => props.item.data || {})
const bonus = computed(() => data.value.weapon?.magic_bonus || data.value.armor_base?.magic_bonus)
const { format } = useCostFormatter()
const cost = computed(() => format(data.value.cost))
</script>
