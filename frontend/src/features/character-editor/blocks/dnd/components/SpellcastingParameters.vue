<template>
  <div class="spell-parameters">
    <div class="spell-parameters-grid" role="group" aria-label="Параметры вкладки магии">
      <BaseTile :outlined="false" class="spell-parameter spell-parameter--base">
        <span class="spell-parameter-label">Базовая хар-ка</span>
        <strong class="spell-parameter-value spell-parameter-value--name">{{ statLabel || '—' }}</strong>
      </BaseTile>
      <BaseTile :outlined="false" class="spell-parameter spell-parameter--attack" :title="attackFormula">
        <span class="spell-parameter-label">Атака заклинанием</span>
        <strong class="spell-parameter-value">{{ attackBonus >= 0 ? '+' + attackBonus : attackBonus }}</strong>
      </BaseTile>
      <BaseTile :outlined="false" class="spell-parameter spell-parameter--save" :title="saveFormula">
        <span class="spell-parameter-label">СЛ спасброска</span>
        <strong class="spell-parameter-value">{{ saveDC }}</strong>
      </BaseTile>
      <div class="spell-parameter-settings-cell">
        <ActionButton class="spell-parameter-settings" variant="dashed" :disabled="!editable" @click="$emit('settings')">
          <template #icon><Settings class="spell-parameter-settings-icon" :size="layoutTokens['spell-settings-icon']" aria-hidden="true" /></template>
          <span class="spell-parameter-settings-label"><span>Настройки</span><span>вкладки</span></span>
        </ActionButton>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ActionButton, BaseTile } from '@sylvieshare/share-ui'
import { Settings } from '@lucide/vue'
import { layoutTokens } from '@/app/design-tokens'
defineProps({ statLabel:String,saveDC:Number,attackBonus:Number,saveFormula:String,attackFormula:String,editable:Boolean })
defineEmits(['settings'])
</script>
<style scoped>
.spell-parameters {min-width:0;container-type:inline-size}
.spell-parameters-grid {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--spacing-small);min-width:0}
.spell-parameter {isolation:isolate;overflow:hidden;min-width:0;min-height:var(--layout-spell-stat-tile-height);display:flex;flex-direction:column;justify-content:center;gap:var(--spacing-xs);padding:var(--spacing-medium) var(--spacing-large);color:var(--text-1)}
.spell-parameter::before {content:'';position:absolute;inset:0;z-index:-1;background:var(--spell-parameter-art) center/cover no-repeat;opacity:.6;filter:brightness(.62);mask-image:linear-gradient(90deg,transparent 0%,transparent 35%,var(--text-1) 100%);pointer-events:none}
.spell-parameter--base {--spell-parameter-art:url('@/assets/ui/spell-stat-base.webp')}
.spell-parameter--attack {--spell-parameter-art:url('@/assets/ui/spell-stat-attack.webp')}
.spell-parameter--save {--spell-parameter-art:url('@/assets/ui/spell-stat-save.webp')}
.spell-parameter-label {color:var(--text-2);font-family:var(--type-spell-parameter-label-family);font-size:var(--type-spell-parameter-label-size);line-height:var(--type-spell-parameter-label-line-height);font-weight:var(--type-spell-parameter-label-weight)}
.spell-parameter-value {color:var(--text-1);font-family:var(--type-spell-parameter-value-family);font-size:var(--type-spell-parameter-value-size);line-height:var(--type-spell-parameter-value-line-height);font-weight:var(--type-spell-parameter-value-weight);font-variant-numeric:tabular-nums}
.spell-parameter-value--name {font-family:var(--type-spell-parameter-name-family);font-size:var(--type-spell-parameter-name-size);line-height:var(--type-spell-parameter-name-line-height);font-weight:var(--type-spell-parameter-name-weight);overflow-wrap:anywhere}
.spell-parameter-settings-cell {display:flex;min-width:0}
.spell-parameter-settings {flex:1;min-width:0}
.spell-parameter-settings-icon {flex:none}
.spell-parameter-settings-label {display:flex;flex-direction:column;align-items:flex-start;line-height:var(--type-group-line-height);text-align:left;white-space:nowrap}
@media (--ui-phone){
  .spell-parameter{min-height:var(--layout-spell-stat-compact-height);padding:var(--spacing-label) var(--spacing-medium)}
  .spell-parameter::before{background-position:right center;background-size:auto 100%;opacity:.42}
  .spell-parameter-label{color:var(--text-1);font-size:var(--type-spell-parameter-label-compact-size);line-height:var(--type-spell-parameter-label-compact-line-height);font-weight:var(--type-spell-parameter-label-compact-weight)}
  .spell-parameter-value{line-height:var(--type-spell-parameter-value-compact-line-height)}
  .spell-parameter-value:not(.spell-parameter-value--name){font-size:var(--type-spell-parameter-value-compact-size)}
}
@container (max-width:560px){.spell-parameters-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container (max-width:300px){
  .spell-parameter-label{font-size:var(--type-context-size);line-height:var(--type-context-line-height)}
}
</style>
