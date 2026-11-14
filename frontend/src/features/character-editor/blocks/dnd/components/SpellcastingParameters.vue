<template>
  <div class="spell-parameters">
    <div class="spell-parameters-grid" role="group" aria-label="Параметры вкладки магии">
      <div class="spell-parameter spell-parameter--base">
        <span class="spell-parameter-label">Базовая хар-ка</span>
        <strong class="spell-parameter-value spell-parameter-value--name">{{ statLabel || '—' }}</strong>
      </div>
      <div class="spell-parameter spell-parameter--attack" :title="attackFormula">
        <span class="spell-parameter-label">Атака заклинанием</span>
        <strong class="spell-parameter-value">{{ attackBonus >= 0 ? '+' + attackBonus : attackBonus }}</strong>
      </div>
      <div class="spell-parameter spell-parameter--save" :title="saveFormula">
        <span class="spell-parameter-label">СЛ спасброска</span>
        <strong class="spell-parameter-value">{{ saveDC }}</strong>
      </div>
      <ActionButton class="spell-parameter-settings" variant="secondary" layout="stacked" :disabled="!editable" @click="$emit('settings')">
        <template #icon><Settings :size="24" aria-hidden="true" /></template>
        <span class="spell-parameter-settings-label">Настройки вкладки</span>
      </ActionButton>
    </div>
  </div>
</template>
<script setup>
import { ActionButton } from '@sylvieshare/share-ui'
import { Settings } from '@lucide/vue'
defineProps({ statLabel:String,saveDC:Number,attackBonus:Number,saveFormula:String,attackFormula:String,editable:Boolean })
defineEmits(['settings'])
</script>
<style scoped>
.spell-parameters {min-width:0;container-type:inline-size}
.spell-parameters-grid {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--spacing-small);min-width:0}
.spell-parameter {position:relative;isolation:isolate;min-width:0;min-height:var(--layout-spell-stat-tile-height);box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;gap:var(--spacing-compact);padding:var(--spacing-medium);color:var(--text-1)}
.spell-parameter::before {content:'';position:absolute;inset:0;z-index:-1;background:var(--spell-parameter-art) center/100% 100% no-repeat;pointer-events:none}
.spell-parameter--base {--spell-parameter-art:url('@/assets/ui/spell-stat-base.webp')}
.spell-parameter--attack {--spell-parameter-art:url('@/assets/ui/spell-stat-attack.webp')}
.spell-parameter--save {--spell-parameter-art:url('@/assets/ui/spell-stat-save.webp')}
.spell-parameter-label {min-height:calc(2 * var(--type-context-line-height));color:var(--text-2);font-family:var(--type-context-family);font-size:var(--type-context-size);line-height:var(--type-context-line-height);font-weight:600;text-transform:uppercase;letter-spacing:.03em}
.spell-parameter-value {color:var(--text-1);font-family:var(--type-sheet-stat-family);font-size:var(--type-sheet-stat-size);line-height:var(--type-sheet-stat-line-height);font-weight:var(--type-sheet-stat-weight);font-variant-numeric:tabular-nums}
.spell-parameter-value--name {font-size:var(--type-sheet-header-size);line-height:var(--type-sheet-header-line-height);overflow-wrap:anywhere}
.spell-parameter-settings {--action-button-min-height:var(--layout-spell-stat-tile-height);--action-button-height:auto}
.spell-parameter-settings-label {color:var(--text-1);font-size:var(--type-group-size);line-height:var(--type-group-line-height);font-weight:600}
@container (max-width:560px){.spell-parameters-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
