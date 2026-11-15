<template>
  <div class="dnd-header-metrics" role="group" aria-label="Показатели персонажа">
    <div v-for="(metric, index) in metrics" :key="metric.key" class="header-metric" :data-header-metric="metric.key">
      <span v-if="index" class="header-metric-divider" aria-hidden="true"><WorkspaceRowDivider /></span>
      <ActionButton variant="quiet" layout="stacked" :aria-label="metric.label" :aria-description="`${metric.value}${metric.unit ? ' ' + metric.unit : ''}`" :title="`${metric.label}: ${metric.value}${metric.unit ? ' ' + metric.unit : ''}`"
        :disabled="!canEdit && !metric.rollable" aria-haspopup="dialog" @click="emit('open', metric.key)">
        <template #icon><span class="header-metric-readout"><component :is="metric.icon" :size="layoutTokens['sheet-header-action-icon']" aria-hidden="true" /><strong>{{ metric.value }}</strong><small v-if="metric.unit && !compact">{{ metric.unit }}</small></span></template>
        <span class="header-metric-label">{{ compact ? metric.shortLabel || metric.label : metric.label }}</span>
      </ActionButton>
    </div>
    <div class="header-metric header-metric--dice" data-header-metric="dice">
      <span class="header-metric-divider" aria-hidden="true"><WorkspaceRowDivider /></span>
      <RowActionMenu title="Кубики" :z-index="4200" follow-anchor block :trigger-attrs="{ style: { display: 'grid', width: '100%' } }">
        <template #trigger="{ open }">
          <ActionButton variant="quiet" layout="stacked" aria-label="Кубики персонажа" aria-haspopup="menu" :aria-expanded="open">
            <template #icon><SystemDie :sides="20" value="" :size="layoutTokens['sheet-header-metric-die']" color="var(--accent-soft)" aria-hidden="true" /></template>Кубики
          </ActionButton>
        </template>
        <template #default="{ close }">
          <RowActionItem v-for="die in SYSTEM_DICE" :key="die.id" @click="roll(die, close)">
            <template #icon><SystemDie :sides="die.sides" :size="layoutTokens['sheet-header-action-icon']" :color="die.color" aria-hidden="true" /></template>
            Бросить {{ die.value }}
          </RowActionItem>
        </template>
      </RowActionMenu>
    </div>
    <div class="header-metric" data-header-metric="add-status">
      <span class="header-metric-divider" aria-hidden="true"><WorkspaceRowDivider /></span>
      <ActionButton variant="quiet" layout="stacked" aria-label="Добавить состояние" aria-haspopup="dialog" :disabled="!canEdit" @click="emit('open', 'add-status')">
        <template #icon><Activity :size="layoutTokens['sheet-header-action-icon']" aria-hidden="true" /></template>
        <span class="header-metric-label">+ состояние</span>
      </ActionButton>
    </div>
  </div>
</template>
<script setup>
import { computed, inject } from 'vue'
import { ActionButton, RowActionMenu } from '@sylvieshare/share-ui'
import { Activity, Award, Footprints, Shield, Zap } from '@lucide/vue'
import { layoutTokens } from '@/app/design-tokens'
import WorkspaceRowDivider from '@/shared/ui/WorkspaceRowDivider.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import SystemDie from '@/shared/ui/SystemDie.vue'
import { SYSTEM_DICE } from '@/shared/lib/systemDice'
import { abilityModifier, formatBonus as signed, resolveNumValue } from '@/shared/lib/dnd'
import { initiativeSummary, proficiencySummary, speedSummary } from '../../lib/utilityValues'
import { useDiceStore } from '@/stores/dice'
defineProps({ compact: Boolean })
const emit = defineEmits(['open'])
const ctx = inject('charCtx', {}), dice = useDiceStore()
const values = computed(() => ctx.values || {})
const canEdit = computed(() => !!ctx.ownerMode)
const metrics = computed(() => [
  { key: 'armor', label: 'КД', icon: Shield, value: ctx.characterArmor?.state?.total ?? 10 + abilityModifier(resolveNumValue(values.value.DEX?.value) || 10) },
  { key: 'speed', label: 'Скорость', icon: Footprints, value: speedSummary(values.value.speed, ctx).total, unit: 'фт' },
  { key: 'initiative', label: 'Инициатива', shortLabel: 'Иниц.', icon: Zap, value: signed(initiativeSummary(values.value.initiative, values.value, ctx).total), rollable: true },
  { key: 'proficiency', label: 'Мастерство', shortLabel: 'Маст.', icon: Award, value: signed(proficiencySummary(values.value.prof_bonus, values.value.lvl?.level).total), rollable: true },
])
function roll(die, close) { close(); dice.roll(die.value, die.id, { crit_mode: die.sides === 20 }) }
</script>
<style scoped>
.dnd-header-metrics {display:grid;grid-template-columns:repeat(auto-fit,minmax(var(--layout-sheet-header-metric-min-width),1fr));width:var(--layout-sheet-header-metrics-width);max-width:100%;min-width:0;--action-button-height:var(--layout-sheet-header-metric-height)}
.header-metric {position:relative;display:grid;align-items:center;min-width:0}
.header-metric-readout {display:flex;align-items:center;justify-content:center;gap:var(--spacing-xs);font-family:var(--type-sheet-header-family);font-size:var(--type-sheet-header-size);line-height:var(--type-sheet-header-line-height);font-variant-numeric:tabular-nums;color:var(--text-1);white-space:nowrap}
.header-metric-readout svg {flex:none;color:var(--text-muted)}
.header-metric-readout small {font-size:var(--type-context-size);color:var(--text-muted)}
.header-metric-label {display:block;max-width:100%;text-wrap:balance}
.header-metric-divider {position:absolute;z-index:1;top:0;left:0;width:var(--layout-sheet-header-metric-height);height:var(--layout-workspace-row-divider-height);transform:rotate(90deg);transform-origin:0 0;pointer-events:none}
</style>
