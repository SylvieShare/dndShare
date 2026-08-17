<template>
  <div class="idc-detail">
    <div v-if="showTitle" class="idc-title-row">
      <ItemIcon v-if="item.iconImageUrl || item.svg" :item="item" :fallback-to-type="false" :size="38" />
      <div class="idc-name">{{ item.name }}</div>
    </div>

    <div v-if="showTitle" class="idc-divider"></div>

    <RichContent v-if="data.desc" class="idc-desc" :html="data.desc" />
    <div v-else class="idc-no-desc">Описание отсутствует</div>

    <template v-if="hasMeta">
      <div class="idc-divider"></div>
      <div class="idc-meta">
        <span v-if="data.weight != null" class="idc-badge">{{ data.weight }} фунт.</span>
        <span v-if="costLabel" class="idc-badge idc-cost">{{ costLabel }}</span>
        <span v-if="data.is_container" class="idc-badge idc-container">Контейнер</span>
        <span v-if="data.consumable" class="idc-badge idc-consumable">Расходуемое</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'

const props = defineProps({
  item: { type: Object, required: true },
  showTitle: { type: Boolean, default: true },
})

const data = computed(() => props.item.data || {})
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
const hasMeta = computed(() => data.value.weight != null || !!costLabel.value || data.value.is_container || data.value.consumable)
</script>

<style scoped>
.idc-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.idc-title-row { display: flex; align-items: center; gap: 12px; }

.idc-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.2;
  padding-right: 24px;
}

.idc-divider { height: 1px; background: var(--border); }

.idc-desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.65;
}

.idc-no-desc { font-size: 13px; color: var(--text-muted); font-style: italic; }

.idc-meta { display: flex; flex-wrap: wrap; gap: 6px; }

.idc-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  color: var(--text-muted);
}
.idc-cost { background: color-mix(in srgb, var(--warning) 13%, transparent); color: var(--warning); }
.idc-container { background: color-mix(in srgb, var(--accent-soft) 15%, transparent); color: var(--accent-soft); }
.idc-consumable { background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); }
</style>
