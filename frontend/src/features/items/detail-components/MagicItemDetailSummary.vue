<template>
  <CoverSummaryLayout :safe-min-height="220">
    <template #left>
      <CoverStatCard :icon="typeIcon" label="Вид предмета" :value="data.type || 'Магический предмет'" size="compact" />
      <CoverStatCard :icon="Gem" label="Редкость" :value="magicItemRarity(data.rarity)" tone="accent" size="compact" />
      <CoverStatCard v-if="bonus" :icon="data.weapon ? Swords : ShieldCheck" label="Магический бонус" :value="`${bonus > 0 ? '+' : ''}${bonus}`" :note="data.weapon ? 'к атаке и урону' : 'к КД'" />
    </template>
    <template #right>
      <CoverStatCard v-if="cost" :icon="Coins" label="Стоимость" :value="cost" size="compact" tone="warning" />
      <CoverStatCard v-if="data.weight != null" :icon="Weight" label="Вес" :value="`${data.weight} фунт.`" size="compact" />
      <CoverStatCard v-if="data.max_use != null" :icon="Zap" label="Зарядов" :value="data.manual_size ? 'Задаёт владелец' : data.max_use" size="compact" />
    </template>
    <template #bottom>
      <CoverSummaryRail :columns="2">
        <CoverSummaryRailItem :icon="Link" label="Настройка">{{ magicAttunementLabel(data.attunement) }}<small v-if="data.attunement_requirement"> · {{ data.attunement_requirement }}</small></CoverSummaryRailItem>
        <CoverSummaryRailItem :icon="data.activation === 'carried' ? Backpack : Hand" label="Свойства действуют">{{ data.activation === 'carried' ? 'В инвентаре' : 'При экипировке' }}<small v-if="data.level > 1"> · с уровня {{ data.level }}</small></CoverSummaryRailItem>
      </CoverSummaryRail>
      <div v-for="base in selectedBases" :key="base.kind" class="magic-selected-base">
        <span class="magic-selected-base-label">{{ base.kind === 'weapon' ? 'Основа оружия' : 'Основа доспеха' }}</span>
        <MagicEquipmentBases :item="base.item" :kind="base.kind" single-column :base-items="baseItem ? [baseItem] : []" :z-index="nestedViewZIndex - 100" />
      </div>
    </template>
  </CoverSummaryLayout>
</template>
<script setup>
import MagicEquipmentBases from '@/features/items/components/MagicEquipmentBases.vue'
import { selectedMagicBases } from '@/features/items/lib/magicItemInstanceView'
import { computed } from 'vue'
import { Backpack, Circle, Coins, FlaskConical, Gem, Hand, Link, Scroll, ShieldCheck, Sparkles, Swords, WandSparkles, Weight, Zap } from '@lucide/vue'
import CoverSummaryLayout from '@/features/items/components/cover/CoverSummaryLayout.vue'
import CoverStatCard from '@/features/items/components/cover/CoverStatCard.vue'
import CoverSummaryRail from '@/features/items/components/cover/CoverSummaryRail.vue'
import CoverSummaryRailItem from '@/features/items/components/cover/CoverSummaryRailItem.vue'
import { magicItemRarity, magicAttunementLabel } from '@/features/items/lib/magicItemPresentation'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'
const props = defineProps({ item: Object, instance: Object, baseItem: Object, nestedViewZIndex: { type: Number, default: 4900 } })
const selectedBases = computed(() => selectedMagicBases(props.item, props.instance))
const data = computed(() => props.item.data || {})
const typeIcon = computed(() => ({ оружие: Swords, доспех: ShieldCheck, щит: ShieldCheck, кольцо: Circle, амулет: Gem, зелье: FlaskConical, свиток: Scroll, посох: WandSparkles, 'волшебная палочка': WandSparkles })[data.value.type] || Sparkles)
const bonus = computed(() => data.value.weapon?.magic_bonus || data.value.armor_base?.magic_bonus)
const { format } = useCostFormatter()
const cost = computed(() => format(data.value.cost))
</script>

<style scoped>
.magic-selected-base { margin-top: 10px; min-width: 0; }
.magic-selected-base-label { display: block; margin-bottom: 5px; font-size: 11px; font-weight: 600; color: var(--text-on-accent); }
</style>
