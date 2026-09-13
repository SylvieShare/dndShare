<template>
  <div v-if="options.length" class="spell-effect-formulas">
    <div v-for="option in options" :key="option.key" class="spell-effect-formula">
      <span>{{ option.label }}</span>
      <span class="spell-effect-math">
        <DamageDice :parts="parts(option)" :modifier="bonus(option)" :size="28" />
        <SpellScalingFormula v-if="!entry.ref?.slotless" :rule="option.rule" :base-level="Number(entry.item.data.lvl)" :size="28" />
      </span>
    </div>
  </div>
</template>
<script setup>
import { computed, inject } from 'vue'
import DamageDice from './DamageDice.vue'
import SpellScalingFormula from './SpellScalingFormula.vue'
import { spellRollOptions } from '../lib/spellRollOptions'
const props = defineProps({ entry: { type: Object, required: true }, castLevel: Number })
const ctx = inject('spellsBlockCtx')
const options = computed(() => spellRollOptions(props.entry).filter(option => !option.primary))
const parts = option => ctx[option.kind === 'heal' ? 'healDiceParts' : 'damageDiceParts'](
  option.entry.item, props.castLevel, ctx.charLevel, ctx.spellAbilityModifier(props.entry))
const bonus = option => parts(option).reduce((sum, part) => sum + part.bonus, 0)
</script>
<style scoped>
.spell-effect-formulas { display: flex; flex-wrap: wrap; gap: 6px 16px; flex-basis: 100%; }
.spell-effect-math { display: inline-flex; align-items: flex-start; gap: 4px; }
.spell-effect-formula { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-muted); }
</style>
