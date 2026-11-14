<template>
  <div class="spell-card-content">
    <SpellCardCover :item="item" />
    <div class="sp-card-main">
      <div class="sp-info">
        <div class="sp-name-row">
          <span class="sp-name"><ItemIcon v-if="school" class="sp-school" :item="school" :size="layoutTokens['spell-card-school-icon']" :color="school.color" />{{ item?.name || '…' }}</span>
          <span v-if="nameEn" class="sp-name-en" :title="nameEn">{{ nameEn }}</span>
        </div>
        <SpellMetadata v-if="item?.data" :data="item.data" :range-override="rangeOverride" :show-components="false" quiet />
        <span v-if="grantSummary" class="sp-grant">{{ grantSummary }}</span>
      </div>
      <SpellComponentBadge :components="item?.data?.components" />
    </div>
    <div v-if="$slots.metrics" class="sp-metrics"><slot name="metrics" /></div>
    <div class="sp-effects"><slot name="effects" /></div>
    <small v-if="scalingHint" class="sp-scaling-hint">{{ scalingHint }}</small>
  </div>
</template>
<script setup>
import SpellCardCover from './SpellCardCover.vue'
import SpellMetadata from '@/features/items/components/SpellMetadata.vue'
import SpellComponentBadge from '@/features/items/components/SpellComponentBadge.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { layoutTokens } from '@/app/design-tokens'
defineProps({ item: Object, school: Object, nameEn: String, rangeOverride: String, grantSummary: String, scalingHint: String })
</script>
<style scoped>
.spell-card-content {position:relative;isolation:isolate;display:grid;gap:var(--spacing-small);min-height:var(--layout-spell-card-min-height);min-width:0;padding:var(--spacing-medium) var(--spacing-large)}
.sp-card-main,.sp-metrics,.sp-effects,.sp-scaling-hint {position:relative;z-index:1;min-width:0}
.sp-card-main {display:grid;grid-template-columns:minmax(0,65%) minmax(0,1fr);align-items:start;gap:var(--spacing-small)}
.sp-info {min-width:0;display:flex;flex-direction:column;gap:var(--spacing-small)}
.sp-name-row {display:flex;align-items:baseline;gap:var(--spacing-compact);min-width:0}
.sp-school {vertical-align:middle;margin-right:var(--spacing-compact)}
.sp-name {flex-shrink:0;max-width:100%;min-width:0;color:var(--text-1);font-family:var(--type-spell-name-family);font-size:var(--type-spell-name-size);font-weight:var(--type-spell-name-weight);line-height:var(--type-spell-name-line-height);overflow-wrap:anywhere}
.sp-name-en {min-width:0;color:var(--text-muted);font-size:var(--type-context-size);line-height:var(--type-context-line-height);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-grant {color:var(--accent-soft);font-size:var(--type-context-size);line-height:var(--type-context-line-height);overflow-wrap:anywhere}
.sp-metrics {display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:var(--spacing-small)}
.sp-effects:empty {display:none}
.sp-scaling-hint {color:var(--text-muted);font-size:var(--type-context-size);line-height:var(--type-context-line-height)}
</style>
