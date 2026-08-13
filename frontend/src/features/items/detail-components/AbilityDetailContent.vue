<template>
  <div class="adc-detail">
    <div v-if="showTitle" class="adc-title-row">
      <ItemIcon v-if="item.svg" :item="item" :fallback-to-type="false" :size="38" />
      <div class="adc-name">{{ item.name }}</div>
    </div>

    <div v-if="showTitle" class="adc-divider"></div>

    <RichContent v-if="data.desc" class="adc-desc" :html="data.desc" />
    <div v-else class="adc-no-desc">Описание отсутствует</div>

    <template v-if="data.max_use || data.rollback_short_rest || data.rollback_long_rest">
      <div class="adc-divider"></div>
      <div class="adc-meta">
        <span v-if="data.max_use" class="adc-badge adc-uses">{{ data.max_use }} исп.</span>
        <span v-if="data.rollback_short_rest" class="adc-badge adc-sr">Короткий отдых</span>
        <span v-if="data.rollback_long_rest" class="adc-badge adc-lr">Длинный отдых</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import RichContent from '@/shared/ui/RichContent'

const props = defineProps({
  item: { type: Object, required: true },
  showTitle: { type: Boolean, default: true },
})

const data = computed(() => props.item.data || {})
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
