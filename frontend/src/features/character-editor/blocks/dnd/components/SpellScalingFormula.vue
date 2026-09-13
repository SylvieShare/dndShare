<template>
  <span v-if="hasInlineSpellScaling(rule)" class="spell-scaling-formula" :style="{ '--scaling-size': `${size}px` }" :title="hint" :aria-label="hint" role="img">
    <span class="scaling-op" aria-hidden="true">+</span>
    <DamageDice :parts="parts" :modifier="bonus" :size="size" :default-color="color" aria-hidden="true" />
    <span class="scaling-op" aria-hidden="true">/</span>
    <span class="scaling-slot" aria-hidden="true">
      <span class="scaling-slot-icon"><SpellSlotSphere :level="baseLevel" :size="Math.round(size * .72)" :interactive="false" /></span>
      <span class="scaling-caption">за круг<br>свыше {{ baseLevel }}-го</span>
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
const parts = computed(() => ctx.damageDiceParts({ data: { damage: { dices: props.rule?.addon } } }))
const bonus = computed(() => parts.value.reduce((sum, part) => sum + part.bonus, 0))
const hint = computed(() => spellScalingHint({ data: { lvl: props.baseLevel, damage: props.rule } }))
</script>
<style scoped>
.spell-scaling-formula { display: inline-flex; align-items: flex-start; gap: 4px; }
.scaling-op { display: inline-flex; align-items: center; height: var(--scaling-size); color: var(--text-muted); font-size: 14px; font-weight: 700; }
.scaling-slot { display: inline-flex; flex-direction: column; align-items: center; }
.scaling-slot-icon { display: inline-flex; align-items: center; justify-content: center; height: var(--scaling-size); }
.scaling-caption { color: var(--text-muted); font-size: 10px; font-weight: 500; line-height: 1.15; text-align: center; white-space: nowrap; }
</style>
