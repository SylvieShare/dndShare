<template>
  <div class="pdc">
    <div class="pdc-hero">
      <ItemIcon v-if="item.iconImageUrl || item.svg" :item="item" :fallback-to-type="false" :size="56" />
      <PotionVial v-else :color="data.color" :rarity="rarity" size="lg" />
      <div class="pdc-hero-info">
        <div v-if="showTitle" class="pdc-name">{{ item.name }}</div>
        <span class="pdc-rarity" :style="{ color: preset.color, borderColor: preset.color }">{{ preset.label }}</span>
      </div>
    </div>

    <div class="pdc-divider"></div>

    <RichContent v-if="data.desc" class="pdc-desc" :html="data.desc" />
    <div v-else class="pdc-no-desc">Описание отсутствует</div>

    <template v-if="hasMeta">
      <div class="pdc-divider"></div>
      <div class="pdc-meta">
        <span v-if="data.weight != null" class="pdc-badge">{{ data.weight }} фунт.</span>
        <span v-if="costLabel" class="pdc-badge pdc-cost">{{ costLabel }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

import ItemIcon from '@/features/items/components/ItemIcon.vue'
import PotionVial from '@/features/items/components/PotionVial'
import RichContent from '@/shared/ui/DndRichContent.vue'
import { rarityOf } from '@/features/items/lib/potionRarity'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
  showTitle: { type: Boolean, default: true },
})

const data = computed(() => props.item.data || {})
const rarity = computed(() => Number(data.value.rarity) || 0)
const preset = computed(() => rarityOf(rarity.value))
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
const hasMeta = computed(() => data.value.weight != null || !!costLabel.value)
</script>

<style scoped>
.pdc {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pdc-hero {
  display: flex;
  align-items: center;
  gap: 18px;
}

.pdc-hero-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.pdc-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.2;
  padding-right: 24px;
}

.pdc-rarity {
  align-self: flex-start;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 3px 10px;
  border: 1px solid;
  border-radius: var(--r-pill);
}

.pdc-divider { height: 1px; background: var(--border); }

.pdc-desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.65;
}

.pdc-no-desc { font-size: 13px; color: var(--text-muted); font-style: italic; }

.pdc-meta { display: flex; flex-wrap: wrap; gap: 6px; }

.pdc-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  color: var(--text-muted);
}
.pdc-cost { background: color-mix(in srgb, var(--warning) 13%, transparent); color: var(--warning); }
</style>
