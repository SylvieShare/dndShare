<template>
  <div class="pdc">
    <div class="pdc-tags">
      <span class="pdc-rarity" :style="{ color: preset.color, borderColor: preset.color }">{{ preset.label }}</span>
      <span v-if="data.weight != null" class="pdc-badge">{{ data.weight }} фунт.</span>
      <span v-if="costLabel" class="pdc-badge pdc-cost">{{ costLabel }}</span>
    </div>

    <div class="pdc-hero">
      <div class="pdc-visual">
        <ItemIcon v-if="item.iconImageUrl || item.svg" :item="item" :fallback-to-type="false" :size="76" />
        <PotionVial v-else :color="data.color" :rarity="rarity" size="lg" />
      </div>
      <div class="pdc-copy">
        <div v-if="showTitle" class="pdc-name">{{ item.name }}</div>
        <RichContent v-if="data.desc" class="pdc-desc" :html="data.desc" />
        <div v-else class="pdc-no-desc">Описание отсутствует</div>
      </div>
    </div>
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
</script>

<style scoped>
.pdc {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pdc-hero {
  display: flex;
  align-items: flex-start;
  gap: 22px;
}
.pdc-visual { flex: 0 0 84px; display: flex; justify-content: center; padding-top: 4px; }
.pdc-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
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

.pdc-desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.65;
}

.pdc-no-desc { font-size: 13px; color: var(--text-muted); font-style: italic; }

.pdc-tags { display: flex; flex-wrap: wrap; gap: 6px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }

.pdc-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  color: var(--text-muted);
}
.pdc-cost { background: color-mix(in srgb, var(--warning) 13%, transparent); color: var(--warning); }
@media (max-width: 520px) { .pdc-hero { gap: 14px; } .pdc-visual { flex-basis: 68px; } }
</style>
