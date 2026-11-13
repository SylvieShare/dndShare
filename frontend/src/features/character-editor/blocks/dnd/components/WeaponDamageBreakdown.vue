<template>
  <TransitionGroup tag="span" class="weapon-damage" :aria-label="label" :css="false"
    @enter="motion.enter" @leave="motion.leave" @enter-cancelled="motion.cancel" @leave-cancelled="motion.cancel">
    <span v-for="(group, gi) in groups" :key="group.type" class="weapon-damage__group" :style="{ '--damage-color': group.color }">
      <TransitionGroup tag="span" class="weapon-damage__terms" :css="false"
        @enter="motion.enter" @leave="motion.leave" @enter-cancelled="motion.cancel" @leave-cancelled="motion.cancel">
        <span v-for="(column, ci) in group.columns" :key="columnKey(column)" class="weapon-damage__addend">
          <span v-if="gi || ci || column.operator === '−'" class="weapon-damage__operator">{{ column.operator }}</span>
          <span class="weapon-damage__column">
            <span class="weapon-damage__formula">
              <template v-for="(terms, vi) in column.variants" :key="vi">
                <span v-if="vi" class="weapon-damage__operator" title="Одной рукой / двумя руками">/</span>
                <span v-if="!terms.length" class="weapon-damage__flat">0</span>
                <span v-for="(term, ti) in terms" :key="ti" class="weapon-damage__value">
                  <span v-if="ti || term.sign !== '+'" class="weapon-damage__operator">{{ term.sign === '-' ? '−' : term.sign }}</span>
                  <template v-if="term.kind === 'dice'">
                    <span v-if="term.n !== 1" class="weapon-damage__count">{{ term.n }}×</span>
                    <SystemDie :sides="term.sides" :value="diceLabels ? 'd' + term.sides : undefined" :size="layoutTokens['weapon-damage-die']" color="currentColor" />
                  </template>
                  <strong v-else class="weapon-damage__flat">{{ term.value }}</strong>
                </span>
              </template>
            </span>
            <small class="weapon-damage__source">{{ column.source }}</small>
          </span>
        </span>
      </TransitionGroup>
      <small v-if="group.type" class="weapon-damage__type">{{ group.type }}</small>
    </span>
  </TransitionGroup>
</template>
<script setup>
import { computed } from 'vue'
import { layoutTokens } from '@/app/design-tokens'
import SystemDie from '@/shared/ui/SystemDie.vue'
import { weaponDamageDisplay } from '../lib/weaponDamageDisplay'
import { useWeaponFormulaMotion } from '../composables/useWeaponFormulaMotion'
const props = defineProps({ rows: { type: Array, default: () => [] }, alternatives: { type: Array, default: () => [] }, damageType: String, damageColor: String,
  label: { type: String, default: 'Состав урона' }, diceLabels: Boolean })
const groups = computed(() => weaponDamageDisplay(props.rows, props.alternatives, { type: props.damageType, color: props.damageColor }))
const motion = useWeaponFormulaMotion()
const columnKey = column => `${column.source}:${JSON.stringify(column.variants)}`
</script>
<style scoped>
.weapon-damage {display:flex;flex-wrap:wrap;align-items:flex-start;gap:var(--spacing-small);min-width:0;max-width:100%}
.weapon-damage__group {display:flex;flex-direction:column;align-items:center;gap:var(--spacing-xs);min-width:0;max-width:100%;color:var(--damage-color);transition:color var(--motion-feedback)}
.weapon-damage__terms,.weapon-damage__formula {display:flex;flex-wrap:wrap;align-items:flex-start;gap:var(--spacing-xs);min-width:0;max-width:100%}
.weapon-damage__addend,.weapon-damage__value {display:inline-flex;align-items:flex-start;gap:2px;min-width:0;max-width:100%}
.weapon-damage__addend {flex:0 0 auto}
.weapon-damage__column {display:flex;flex-direction:column;align-items:center;gap:0;min-width:0;max-width:100%}
.weapon-damage__formula {align-items:center;justify-content:center;min-height:var(--layout-weapon-damage-die)}
.weapon-damage__value {align-items:center}
.weapon-damage__flat {display:inline-flex;align-items:center;min-height:var(--layout-weapon-damage-die);font-family:var(--type-weapon-damage-value-family);font-size:var(--type-weapon-damage-value-size);line-height:var(--type-weapon-damage-value-line-height);font-weight:var(--type-weapon-damage-value-weight);font-variant-numeric:tabular-nums}
.weapon-damage__operator,.weapon-damage__count {display:inline-flex;align-items:center;height:var(--layout-weapon-damage-die);font-size:18px;font-weight:600}
.weapon-damage__operator {color:var(--text-muted)}
.weapon-damage__source {max-width:calc(var(--layout-weapon-damage-die) * 2);color:var(--text-muted);font-size:var(--type-context-size);line-height:var(--type-context-line-height);font-weight:500;text-align:center;overflow-wrap:anywhere;white-space:normal}
.weapon-damage__type {align-self:stretch;padding-block-start:var(--spacing-xs);border-block-start:var(--layout-border) solid color-mix(in srgb,var(--damage-color) 70%,transparent);font-size:var(--type-context-size);line-height:var(--type-context-line-height);font-weight:600;text-align:center;overflow-wrap:anywhere;white-space:normal}
@media (prefers-reduced-motion:reduce) {.weapon-damage__group {transition:none}}
</style>
