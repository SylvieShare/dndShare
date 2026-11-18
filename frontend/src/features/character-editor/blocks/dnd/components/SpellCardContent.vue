<template>
  <div class="spell-card-content">
    <div class="sp-card-main">
      <ItemIcon :item="item" :type="itemType" size="var(--spell-card-icon-size)" placeholder />
      <div class="sp-info">
        <div class="sp-name-row">
          <div class="sp-title-row"><span class="sp-name">{{ item?.name || '…' }}</span>{{ prepared ? ' ' : '' }}<span v-if="prepared" class="sp-prepared">[Подготовлено]</span></div>
          <span v-if="nameEn" class="sp-name-en" :title="nameEn">{{ nameEn }}</span>
        </div>
        <span v-if="grantSummary" class="sp-grant">{{ grantSummary }}</span>
      </div>
    </div>
    <div v-if="item?.data" class="sp-meta">
      <SpellMetadata :data="item.data" :range-override="rangeOverride" :show-components="false" quiet />
      <SpellComponentBadge class="sp-components" :components="item.data.components" />
    </div>
    <div v-if="$slots.metrics" class="sp-metrics"><slot name="metrics" /></div>
    <small v-if="scalingHint" class="sp-scaling-hint">{{ scalingHint }}</small>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import SpellMetadata from '@/features/items/components/SpellMetadata.vue'
import SpellComponentBadge from '@/features/items/components/SpellComponentBadge.vue'
import { useItemTypesStore } from '@/stores/itemTypes'

const props = defineProps({ item: Object, nameEn: String, rangeOverride: String, grantSummary: String, scalingHint: String, prepared: Boolean })
const itemTypes = useItemTypesStore()
const itemType = computed(() => itemTypes.getType(Number(props.item?.typeId) || 5))
</script>
<style scoped>
.spell-card-content {display:flex;flex-direction:column;gap:var(--spacing-small);height:100%;box-sizing:border-box;min-height:var(--layout-spell-card-min-height);min-width:0;padding:var(--spacing-medium)}
.sp-card-main,.sp-meta,.sp-metrics,.sp-scaling-hint {min-width:0}
.sp-card-main {
  --spell-card-icon-size: var(--layout-spell-card-icon);
  display: grid;
  grid-template-columns: var(--spell-card-icon-size) minmax(0, 1fr);
  align-items: start;
  gap: var(--spacing-compact);
}
.sp-info {min-width:0;display:flex;flex-direction:column;gap:var(--spacing-small)}
.sp-meta {display:flex;flex-wrap:wrap;align-items:flex-start;gap:var(--spacing-small)}
.sp-meta>.spell-metadata {flex:1 1 var(--layout-spell-metric-min);min-width:0}
.sp-components {flex:none;align-self:flex-start;margin-inline-start:auto}
.sp-name-row {display:flex;flex-direction:column;align-items:flex-start;gap:var(--spacing-compact);min-width:0}
.sp-title-row {min-width:0;max-width:100%;overflow-wrap:anywhere}
.sp-prepared {display:inline-block;max-width:100%;color:var(--accent-soft);font-family:var(--type-context-family);font-size:var(--type-context-size);line-height:var(--type-context-line-height);font-weight:700;overflow-wrap:anywhere}
.sp-name {flex-shrink:0;max-width:100%;min-width:0;color:var(--text-1);font-family:var(--type-spell-name-family);font-size:var(--type-spell-name-size);font-weight:var(--type-spell-name-weight);line-height:var(--type-spell-name-line-height);overflow-wrap:anywhere}
.sp-name-en {max-width:100%;min-width:0;color:var(--text-muted);font-size:var(--type-context-size);line-height:var(--type-context-line-height);overflow-wrap:anywhere}
.sp-grant {color:var(--accent-soft);font-size:var(--type-context-size);line-height:var(--type-context-line-height);overflow-wrap:anywhere}
.sp-metrics {display:flex;flex-direction:column;gap:var(--spacing-small);margin-block-start:auto}
.sp-metrics:empty {display:none}
.sp-scaling-hint {color:var(--text-muted);font-size:var(--type-context-size);line-height:var(--type-context-line-height)}
@container (max-width:240px) {
  .sp-card-main {--spell-card-icon-size:var(--layout-spell-card-compact-icon);column-gap:var(--spacing-xs)}
  .sp-name {font-family:var(--type-spell-card-compact-name-family);font-size:var(--type-spell-card-compact-name-size);line-height:var(--type-spell-card-compact-name-line-height);font-weight:var(--type-spell-card-compact-name-weight)}
}
</style>
