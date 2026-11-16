<template>
  <div class="spell-card-content">
    <SpellCardCover :item="item" />
    <div class="sp-card-main">
      <div class="sp-info">
        <div class="sp-name-row">
          <span class="sp-name">{{ item?.name || '…' }}</span>
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
import SpellCardCover from './SpellCardCover.vue'
import SpellMetadata from '@/features/items/components/SpellMetadata.vue'
import SpellComponentBadge from '@/features/items/components/SpellComponentBadge.vue'
defineProps({ item: Object, nameEn: String, rangeOverride: String, grantSummary: String, scalingHint: String })
</script>
<style scoped>
.spell-card-content {position:relative;isolation:isolate;display:flex;flex-direction:column;gap:var(--spacing-small);height:100%;box-sizing:border-box;min-height:var(--layout-spell-card-min-height);min-width:0;padding:var(--spacing-medium)}
.sp-card-main,.sp-meta,.sp-metrics,.sp-scaling-hint {position:relative;z-index:1;min-width:0}
.sp-card-main {display:flex;align-items:start;gap:var(--spacing-small)}
.sp-info {min-width:0;display:flex;flex-direction:column;gap:var(--spacing-small)}
.sp-meta {display:flex;flex-wrap:wrap;align-items:flex-start;gap:var(--spacing-small)}
.sp-meta>.spell-metadata {flex:1 1 var(--layout-spell-metric-min);min-width:0}
.sp-components {flex:none;align-self:flex-start;margin-inline-start:auto}
.sp-name-row {display:flex;flex-direction:column;align-items:flex-start;gap:var(--spacing-compact);min-width:0}
.sp-name {flex-shrink:0;max-width:100%;min-width:0;color:var(--text-1);font-family:var(--type-spell-name-family);font-size:var(--type-spell-name-size);font-weight:var(--type-spell-name-weight);line-height:var(--type-spell-name-line-height);overflow-wrap:anywhere}
.sp-name-en {max-width:100%;min-width:0;color:var(--text-muted);font-size:var(--type-context-size);line-height:var(--type-context-line-height);overflow-wrap:anywhere}
.sp-grant {color:var(--accent-soft);font-size:var(--type-context-size);line-height:var(--type-context-line-height);overflow-wrap:anywhere}
.sp-metrics {display:flex;flex-direction:column;gap:var(--spacing-small);margin-block-start:auto}
.sp-metrics:empty {display:none}
.sp-scaling-hint {color:var(--text-muted);font-size:var(--type-context-size);line-height:var(--type-context-line-height)}
@container (max-width:240px) {
  .sp-name {font-family:var(--type-spell-card-compact-name-family);font-size:var(--type-spell-card-compact-name-size);line-height:var(--type-spell-card-compact-name-line-height);font-weight:var(--type-spell-card-compact-name-weight)}
}
</style>
