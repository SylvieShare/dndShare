<template>
  <div class="status-effect-summary" :style="effectStyle">
    <CoverSummaryLayout
      :side-min="132"
      :side-max="190"
      :center-min="150"
      :safe-min-height="150"
      :medium-center-min="80"
    >
      <template #left>
        <CoverStatCard
          :icon="polarityIcon"
          label="Воздействие"
          :value="polarity.label"
          :note="polarity.note"
          :tone="polarity.tone"
          size="compact"
        />
        <CoverStatCard :icon="Clock3" label="Длительность" :value="durationLabel" size="compact" />
      </template>

      <template #right>
        <CoverStatCard :icon="Layers3" label="Наложение" :value="stackingLabel" size="compact" />
        <CoverStatCard
          :icon="Focus"
          label="Концентрация"
          :value="data.concentration ? 'Требуется' : 'Не требуется'"
          :tone="data.concentration ? 'warning' : 'neutral'"
          size="compact"
        />
      </template>

      <template #bottom>
        <CoverSummaryRail :columns="maxLevel > 1 ? 2 : 1">
          <CoverSummaryRailItem :icon="ListChecks" label="Механика">{{ mechanicsLabel }}</CoverSummaryRailItem>
          <CoverSummaryRailItem v-if="maxLevel > 1" :icon="Gauge" label="Уровни">От 1 до {{ maxLevel }}</CoverSummaryRailItem>
        </CoverSummaryRail>
      </template>
    </CoverSummaryLayout>

    <div class="status-effect-emblem" aria-hidden="true">
      <ItemIcon
        v-if="item.iconImageUrl || item.svg || type?.iconImageUrl"
        :item="item"
        :type="type"
        :size="108"
      />
      <Sparkles v-else />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { CircleMinus, CirclePlus, Clock3, Focus, Gauge, Layers3, ListChecks, Sparkles } from '@lucide/vue'
import CoverStatCard from '@/features/items/components/cover/CoverStatCard.vue'
import CoverSummaryLayout from '@/features/items/components/cover/CoverSummaryLayout.vue'
import CoverSummaryRail from '@/features/items/components/cover/CoverSummaryRail.vue'
import CoverSummaryRailItem from '@/features/items/components/cover/CoverSummaryRailItem.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import {
  statusDuration,
  statusMechanicsLabel,
  statusPolarity,
  statusStacking,
} from '@/features/items/lib/statusEffectPresentation'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const data = computed(() => props.item.data || {})
const polarity = computed(() => statusPolarity(data.value.polarity))
const polarityIcon = computed(() => data.value.polarity === 'negative' ? CircleMinus : data.value.polarity === 'positive' ? CirclePlus : Sparkles)
const durationLabel = computed(() => statusDuration(data.value.duration))
const stackingLabel = computed(() => statusStacking(data.value.stacking))
const mechanicsLabel = computed(() => statusMechanicsLabel(data.value))
const maxLevel = computed(() => Math.max(0, Number(data.value.max_level) || 0))
const effectStyle = computed(() => {
  const color = String(data.value.color || '').trim()
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color) ? { '--effect-color': color } : {}
})
</script>

<style scoped>
.status-effect-summary {
  position: relative;
  flex: 1;
  width: 100%;
  display: flex;
}

.status-effect-emblem {
  position: absolute;
  top: 5px;
  left: 50%;
  width: 126px;
  height: 126px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--effect-color, var(--accent)) 42%, transparent);
  border-radius: 32px;
  background:
    radial-gradient(circle, color-mix(in srgb, var(--effect-color, var(--accent)) 24%, var(--surface) 50%), color-mix(in srgb, var(--surface) 64%, transparent) 68%);
  box-shadow: 0 14px 34px color-mix(in srgb, var(--scrim) 48%, transparent);
  transform: translateX(-50%) rotate(3deg);
  backdrop-filter: blur(5px);
}

.status-effect-emblem :deep(.item-icon),
.status-effect-emblem > svg {
  filter: drop-shadow(0 7px 12px color-mix(in srgb, var(--scrim) 62%, transparent));
  transform: rotate(-3deg);
}

.status-effect-emblem > svg {
  width: 62px;
  height: 62px;
  color: var(--effect-color, var(--accent-soft));
}

@media (max-width: 700px) {
  .status-effect-emblem { width: 104px; height: 104px; border-radius: 27px; }
  .status-effect-emblem :deep(.item-icon) { width: 88px !important; height: 88px !important; }
}

@media (max-width: 520px) {
  .status-effect-emblem { display: none; }
}
</style>
