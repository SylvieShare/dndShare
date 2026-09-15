<template>
  <span v-if="ctx.maxSlotLevel > baseLevel && hasInlineSpellScaling(rule)" class="spell-scaling" :style="{ '--scaling-size': `${compactSize}px` }" :title="hint" :aria-label="hint" role="img">
    <span class="scaling-op" aria-hidden="true">+</span>
    <span class="spell-scaling-formula">
      <DamageDice :parts="parts" :modifier="bonus" :size="compactSize" :default-color="color" aria-hidden="true" />
      <span class="scaling-op" aria-hidden="true">×</span>
      <span class="scaling-slot" aria-hidden="true">
        <span class="scaling-slot-icon"><SpellSlotSphere :level="baseLevel" :size="Math.round(compactSize * .72)" :interactive="false" /></span>
        <span class="scaling-caption">за круг<br>свыше {{ baseLevel }}-го</span>
      </span>
    </span>
  </span>
</template>
<script setup>
import { computed, inject } from 'vue'
import DamageDice from './DamageDice.vue'
import SpellSlotSphere from '@/features/items/components/SpellSlotSphere.vue'
import { hasInlineSpellScaling, spellScalingHint } from '../lib/spellScaling'

const props = defineProps({ rule: Object, baseLevel: Number, size: { type: Number, default: 42 }, color: { type: String, default: 'var(--warning)' } })
const ctx = inject('spellsBlockCtx')
const compactSize = computed(() => Math.max(20, Math.round(props.size * .7)))
const parts = computed(() => ctx.damageDiceParts({ data: { damage: { dices: props.rule?.addon } } }))
const bonus = computed(() => parts.value.reduce((sum, part) => sum + part.bonus, 0))
const hint = computed(() => spellScalingHint({ data: { lvl: props.baseLevel, damage: props.rule } }))
</script>
<style scoped>
.spell-scaling { display: inline-flex; align-items: flex-start; gap: 5px; }
.spell-scaling > .scaling-op { padding-top: 5px; }
.spell-scaling-formula { display: inline-flex; align-items: flex-start; gap: 3px; padding: 4px 6px; border: 1px dashed var(--text-muted); border-radius: 6px; }
.scaling-op { display: inline-flex; align-items: center; height: var(--scaling-size); color: var(--text-muted); font-size: 12px; font-weight: 700; }
.scaling-slot { display: inline-flex; flex-direction: column; align-items: center; }
.scaling-slot-icon { display: inline-flex; align-items: center; justify-content: center; height: var(--scaling-size); }
.scaling-caption { color: var(--text-muted); font-size: 9px; font-weight: 500; line-height: 1.15; text-align: center; white-space: nowrap; }
</style>
