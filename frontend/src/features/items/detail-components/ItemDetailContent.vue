<template>
  <div class="idc-detail">
    <div class="idc-name">{{ item.name }}</div>

    <div class="idc-divider"></div>

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
import RichContent from '@/shared/ui/RichContent'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'

const props = defineProps({
  item: { type: Object, required: true },
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

.idc-name {
  font-size: 22px;
  font-weight: 700;
  color: #eeeeF4;
  line-height: 1.2;
  padding-right: 24px;
}

.idc-divider { height: 1px; background: var(--border); }

.idc-desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.65;
}

.idc-no-desc { font-size: 13px; color: #383838; font-style: italic; }

.idc-meta { display: flex; flex-wrap: wrap; gap: 6px; }

.idc-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 5px;
  background: rgba(255,255,255,0.06);
  color: var(--text-muted);
}
.idc-cost { background: rgba(252,190,36,0.13); color: var(--warning); }
.idc-container { background: rgba(162,146,255,0.15); color: var(--color-attack); }
.idc-consumable { background: rgba(90,175,114,0.15); color: #5aaf72; }
</style>
