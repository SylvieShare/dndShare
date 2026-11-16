<template>
  <span ref="root" class="weapon-damage" :aria-label="label">
    <span v-for="(group, gi) in groups" :key="group.type" class="weapon-damage__group" :style="{ '--damage-color': group.color }">
      <span class="weapon-damage__terms">
        <span v-for="(column, ci) in group.columns" :key="column.key" class="weapon-damage__addend"
          :data-formula-key="JSON.stringify([group.type, column.key])" :data-formula-roll="column.roll || undefined"
          :data-formula-signature="columnSignature(column, gi, ci)">
          <span v-if="gi || ci || column.operator === '−'" class="weapon-damage__operator">{{ column.operator }}</span>
          <span class="weapon-damage__column" :class="{ 'weapon-damage__column--grips': column.variants.length === 2 }">
            <span class="weapon-damage__formula">
              <template v-for="(run, ri) in formulaRuns(column)" :key="ri">
                <span v-if="run.separator" class="weapon-damage__operator" :title="run.separator === '/' ? 'Одной рукой / двумя руками' : undefined">{{ run.separator }}</span>
                <span v-if="!run.terms.length" class="weapon-damage__flat">0</span>
                <span v-for="(term, ti) in run.terms" :key="ti" class="weapon-damage__value"
                  :style="column.roll && term.kind === 'dice' && term.sides === 20 && rollColor ? { color: rollColor } : undefined">
                  <span v-if="ti || term.sign !== '+'" class="weapon-damage__operator">{{ term.sign === '-' ? '−' : term.sign }}</span>
                  <template v-if="term.kind === 'dice'">
                    <span v-if="term.n !== 1" class="weapon-damage__count">{{ term.n }}×</span>
                    <span class="weapon-damage__die"><SystemDie :sides="term.sides" :size="layoutTokens['weapon-damage-die']" color="currentColor" />
                      <WeaponGripIcon v-if="run.grip" :hands="run.grip" />
                    </span>
                  </template>
                  <strong v-else class="weapon-damage__flat">{{ term.value }}</strong>
                </span>
              </template>
            </span>
            <small v-if="showSources" class="weapon-damage__source">{{ column.source }}</small>
          </span>
        </span>
      </span>
      <small v-if="group.type" class="weapon-damage__type">{{ group.type }}</small>
    </span>
    <span v-for="flash in flashes" :key="flash.id" class="weapon-formula-flash" :data-formula-flash="flash.key" :style="flash.style" aria-hidden="true"
      @animationend="removeFlash(flash.id)" @animationcancel="removeFlash(flash.id)" />
  </span>
</template>
<script setup>
import { computed, ref } from 'vue'
import { layoutTokens } from '@/app/design-tokens'
import SystemDie from '@/shared/ui/SystemDie.vue'
import WeaponGripIcon from './WeaponGripIcon.vue'
import { weaponDamageDisplay } from '../lib/weaponDamageDisplay'
import { useWeaponFormulaFlash } from '../composables/useWeaponFormulaFlash'
const props = defineProps({ rows: { type: Array, default: () => [] }, alternatives: { type: Array, default: () => [] }, damageType: String, damageColor: String,
  label: { type: String, default: 'Состав урона' }, rollColor: String, showSources: { type: Boolean, default: true } })
const groups = computed(() => weaponDamageDisplay(props.rows, props.alternatives, { type: props.damageType, color: props.damageColor }))
const root = ref(null)
const { flashes, removeFlash } = useWeaponFormulaFlash(root)
const columnSignature = (column, gi, ci) => JSON.stringify([column.source, column.operator, column.variants, column.shared,
  !!(gi || ci || column.operator === '−'), column.roll ? props.rollColor : null])
const formulaRuns = column => [
  ...column.variants.map((terms, index) => ({ terms, separator: index ? '/' : '', grip: column.variants.length === 2 ? index + 1 : 0 })),
  ...(column.shared.length ? [{ terms: column.shared, separator: column.shared[0].sign === '+' ? '+' : '' }] : []),
]
</script>
<style scoped>
.weapon-damage {position:relative;isolation:isolate;display:flex;flex-wrap:wrap;align-items:flex-start;gap:var(--spacing-small);min-width:0;max-width:100%}
.weapon-damage__group {display:flex;flex-direction:column;align-items:center;gap:var(--spacing-xs);min-width:0;max-width:100%;color:var(--damage-color)}
.weapon-damage__terms,.weapon-damage__formula {display:flex;flex-wrap:wrap;align-items:flex-start;gap:var(--spacing-xs);min-width:0;max-width:100%}
.weapon-damage__addend,.weapon-damage__value {display:inline-flex;align-items:flex-start;gap:2px;min-width:0;max-width:100%}
.weapon-damage__addend {flex:0 0 auto}
.weapon-damage__column {display:flex;flex-direction:column;align-items:center;gap:0;min-width:0;max-width:100%}
.weapon-damage__column--grips {display:grid;justify-items:center}
.weapon-damage__column--grips .weapon-damage__source {grid-column:1/-1;justify-self:stretch;max-width:none}
.weapon-damage__column--grips .weapon-damage__formula {padding-bottom:var(--spacing-xs)}
.weapon-damage__die {position:relative;display:inline-flex;flex:none}
.weapon-damage__die > .weapon-grip {position:absolute;right:-4px;bottom:-3px}
.weapon-damage__formula {align-items:center;justify-content:center;min-height:var(--layout-weapon-damage-die)}
.weapon-damage__value {align-items:center}
.weapon-damage__flat {display:inline-flex;align-items:center;min-height:var(--layout-weapon-damage-die);font-family:var(--type-weapon-damage-value-family);font-size:var(--type-weapon-damage-value-size);line-height:var(--type-weapon-damage-value-line-height);font-weight:var(--type-weapon-damage-value-weight);font-variant-numeric:tabular-nums}
.weapon-damage__operator,.weapon-damage__count {display:inline-flex;align-items:center;height:var(--layout-weapon-damage-die);font-size:18px;font-weight:600}
.weapon-damage__operator {color:var(--text-muted)}
.weapon-damage__source {max-width:calc(var(--layout-weapon-damage-die) * 2);color:var(--text-muted);font-size:var(--type-context-size);line-height:var(--type-context-line-height);font-weight:500;text-align:center;overflow-wrap:anywhere;white-space:normal}
.weapon-damage__type {align-self:stretch;padding-block-start:var(--spacing-xs);border-block-start:var(--layout-border) solid color-mix(in srgb,var(--damage-color) 70%,transparent);font-size:var(--type-context-size);line-height:var(--type-context-line-height);font-weight:600;text-align:center;overflow-wrap:anywhere;white-space:normal}
.weapon-formula-flash {position:absolute;z-index:-1;pointer-events:none;border-radius:var(--radius-input);background:color-mix(in srgb,var(--accent-soft) 35%,transparent);opacity:0;animation:weapon-formula-flash var(--motion-navigation) ease-out}
@keyframes weapon-formula-flash {0%,100% {opacity:0} 15% {opacity:1}}
@media (prefers-reduced-motion:reduce) {.weapon-formula-flash {display:none;animation:none}}
</style>
