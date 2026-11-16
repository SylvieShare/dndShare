<template>
  <div class="spell-metrics" role="group" aria-label="Показатели заклинания">
    <CharacterCombatMetric v-if="hasAttack" kind="attack" label="Атака" compact interactive action-label="Настроить бросок атаки"
      @roll="emit('roll', 'attack', $event)">
      <strong class="spell-metric-attack">{{ ctx.formatBonus(ctx.spellAttackBonus(entry)) }}</strong>
    </CharacterCombatMetric>
    <CharacterCombatMetric v-for="metric in metrics" :key="metric.key" :kind="metric.visualKind" :label="metric.label" compact
      :interactive="metric.interactive" :action-label="metric.actionLabel" @roll="emit('roll', metric.key, $event)">
      <small v-if="!metric.primary" class="spell-metric-title">{{ metric.title }}</small>
      <strong v-if="metric.kind === 'save'" class="spell-metric-attack">Сл {{ ctx.spellSaveDC(metric.entry) }}</strong>
      <div v-else class="spell-metric-formula-row">
        <WeaponDamageBreakdown :rows="metric.rows" :show-sources="false" :damage-color="metric.color" :label="metric.title" />
        <SpellScalingFormula v-if="!entry.ref?.slotless && metric.rule.scaling === 'slot' && hasInlineSpellScaling(metric.rule)"
          :rule="metric.rule" :base-level="Number(entry.item.data.lvl)" :color="metric.color" :size="32" />
      </div>
    </CharacterCombatMetric>
  </div>
</template>
<script setup>
import { computed, inject, toRef } from 'vue'
import CharacterCombatMetric from './CharacterCombatMetric.vue'
import WeaponDamageBreakdown from './WeaponDamageBreakdown.vue'
import SpellScalingFormula from './SpellScalingFormula.vue'
import { spellRollOptions } from '../lib/spellRollOptions'
import { hasInlineSpellScaling } from '../lib/spellScaling'
import { spellMetricRows } from '../lib/spellMetricRows'
import { useSpellRollOptions } from '../composables/useSpellRollOptions'
const props = defineProps({ entry: { type: Object, required: true }, castLevel: Number })
const emit = defineEmits(['roll'])
const ctx = inject('spellsBlockCtx')
const { hasAttack, hasSequence } = useSpellRollOptions(toRef(props, 'entry'))
const metrics = computed(() => spellRollOptions(props.entry).map(option => {
  const heal = option.kind === 'heal', temporary = heal && option.rule.kind === 'temporary_hp'
  const label = temporary ? 'Врем. хиты' : heal ? 'Лечение' : option.kind === 'save' ? 'Спасбросок' : option.kind === 'damage' ? 'Урон' : 'Эффект'
  const parts = option.kind === 'save' ? [] : ctx[heal ? 'healDiceParts' : 'damageDiceParts'](option.entry.item, props.castLevel, ctx.charLevel, ctx.spellAbilityModifier?.(option.entry) || 0)
  return { ...option, visualKind: temporary ? 'temporary_hp' : heal ? 'healing' : option.kind,
    label, title: option.primary ? label : option.label,
    actionLabel: option.primary ? `Настроить бросок ${heal ? 'лечения' : 'урона'}` : `Настроить: ${option.label}`,
    rows: spellMetricRows(parts, !heal), color: temporary ? 'var(--info)' : heal ? 'var(--success)' : 'var(--warning)',
    interactive: !(hasSequence.value && option.primary && option.kind === 'damage'),
  }
}))
</script>
<style scoped>
.spell-metrics {display:grid;grid-template-columns:minmax(0,1fr);gap:var(--layout-weapon-metrics-gap);min-width:0;width:100%}
.spell-metric-formula-row {display:flex;flex-wrap:wrap;align-items:flex-start;gap:var(--spacing-small);min-width:0;max-width:100%}
.spell-metric-formula-row>.spell-scaling {flex:0 1 auto;min-width:0;max-width:100%}
.spell-metric-attack {color:var(--accent-soft);font-family:var(--type-weapon-attack-family);font-size:var(--type-weapon-attack-size);font-weight:var(--type-weapon-attack-weight);line-height:var(--type-weapon-attack-line-height)}
.spell-metric-title {color:var(--text-muted);font-size:var(--type-context-size);line-height:var(--type-context-line-height);overflow-wrap:anywhere}
</style>
