<template>
  <div class="adc-detail">
    <div v-if="showTitle" class="adc-title-row">
      <ItemIcon v-if="item.iconImageUrl || item.svg" :item="item" :fallback-to-type="false" :size="38" />
      <div class="adc-name">{{ item.name }}</div>
    </div>

    <div v-if="showTitle" class="adc-divider"></div>

    <DetailSection label="Описание">
      <template #icon><Sparkles /></template>
      <RichContent v-if="data.desc" class="adc-desc" :html="data.desc" />
      <div v-else class="adc-no-desc">Описание отсутствует</div>
    </DetailSection>

    <DetailSection v-if="useRuleLabel || data.rollback_short_rest || data.rollback_long_rest" label="Использование">
      <template #icon><RefreshCcw /></template>
      <div class="adc-meta">
        <span v-if="useRuleLabel" class="adc-badge adc-uses">{{ useRuleLabel }}</span>
        <span v-if="data.rollback_short_rest" class="adc-badge adc-sr">Короткий отдых</span>
        <span v-if="data.rollback_long_rest" class="adc-badge adc-lr">Длинный отдых</span>
      </div>
    </DetailSection>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { RefreshCcw, Sparkles } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import DetailSection from '@/shared/ui/DetailSection.vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
import { STAT_FULL, SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'

const props = defineProps({
  item: { type: Object, required: true },
  showTitle: { type: Boolean, default: true },
})

const data = computed(() => props.item.data || {})
const useRuleLabel = computed(() => {
  const stat = SUGGEST16_TO_STAT[Number(data.value.max_use_stat)]
  if (stat) {
    const minimum = data.value.max_use_min == null ? 1 : Math.max(0, Number(data.value.max_use_min) || 0)
    return `Модификатор ${STAT_FULL[stat].toLowerCase()}, минимум ${minimum}`
  }
  return data.value.max_use ? `${data.value.max_use} исп.` : ''
})
</script>

<style scoped>
.adc-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.adc-title-row { display: flex; align-items: center; gap: 12px; }

.adc-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.2;
  padding-right: 24px;
}

.adc-divider { height: 1px; background: var(--border); }

.adc-desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.65;
}

.adc-no-desc { font-size: 13px; color: var(--text-muted); font-style: italic; }

.adc-meta { display: flex; flex-wrap: wrap; gap: 6px; }

.adc-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 5px;
}
.adc-uses { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); color: var(--text-muted); }
.adc-sr   { background: color-mix(in srgb, var(--success) 15%, transparent);  color: var(--success); }
.adc-lr   { background: color-mix(in srgb, var(--info) 15%, transparent);  color: var(--info); }
</style>
