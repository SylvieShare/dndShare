<template>
  <div class="dice-roll-result" :class="outcomeKind ? `dice-roll-result--${outcomeKind}` : ''" :aria-busy="!!result.pending" :aria-label="result.pending ? 'Ожидаем результат броска' : `Результат броска: ${result.total}${outcomeLabel ? `, ${outcomeLabel}` : ''}`">
    <template v-for="(part, index) in result.parts || []" :key="index">
      <span v-if="index || part.sign === '-'">{{ part.sign || '+' }}</span>
      <template v-if="part.kind === 'dice'">
        <template v-for="(value, i) in part.rolls" :key="i">
          <span v-if="i">+</span>
          <span :class="{ 'dice-roll-result-dropped': !isRolling(id) && (part.dropped?.includes(i) || (part.keptIndex != null && part.keptIndex !== i)), 'dice-roll-result-rolling': isRolling(id) }" :title="part.dropped?.includes(i) || (part.keptIndex != null && part.keptIndex !== i) ? 'Не учитывается' : ''">
          <SystemDie :sides="part.sides" :value="displayedRoll(entry, index, i, value)" :size="size" :animated="false" :color="part.color || color || result.color || 'var(--accent-soft)'" />
          </span>
        </template>
      </template>
      <span v-else :style="{ color: part.color || color || result.color }">{{ part.value }}</span>
    </template>
    <strong>= {{ displayedTotal(entry) }}</strong>
    <span v-if="outcomeLabel" class="dice-roll-result-outcome">{{ outcomeLabel }}</span>
  </div>
</template>
<script setup>
import SystemDie from './SystemDie.vue'
import { computed, onBeforeUnmount, useId, watch } from 'vue'
import { useDiceRollAnimation } from '@/shared/composables/useDiceRollAnimation'
const props = defineProps({ result: { type: Object, required: true }, outcome: { type: Object, default: null }, size: { type: Number, default: 28 }, color: { type: String, default: '' }, animated: Boolean })
const id = useId()
const entry = computed(() => ({ id, result: props.result }))
const { displayedRoll, displayedTotal, isRolling, startEntryAnimation, dispose } = useDiceRollAnimation({
  shouldAnimate: () => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
})
watch(() => props.result, (result, previous) => {
  if (props.animated || result.pending || previous?.pending) startEntryAnimation(entry.value)
}, { immediate: true })
onBeforeUnmount(dispose)
const outcomeKind = computed(() => !props.result.pending && !isRolling(id) && ['crit', 'fumble'].includes(props.outcome?.kind) ? props.outcome.kind : '')
const outcomeLabel = computed(() => ({ crit: 'Критический успех', fumble: 'Критический провал' })[outcomeKind.value] || '')
</script>
<style scoped>
.dice-roll-result { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; color: var(--text-2); }
.dice-roll-result strong { white-space: nowrap; color: var(--text-1); font-size: 16px; margin-left: 3px; }
.dice-roll-result-dropped { opacity: .35; text-decoration: line-through; }
.dice-roll-result-rolling { display: inline-flex; opacity: .65; animation: dice-roll-result-tumble .56s ease-in-out infinite; }
@keyframes dice-roll-result-tumble { 0%, 100% { transform: rotate(-8deg) scale(.96); } 50% { transform: translateY(-3px) rotate(8deg); } }
@media (prefers-reduced-motion: reduce) { .dice-roll-result-rolling { animation: none; } }
.dice-roll-result--crit, .dice-roll-result--fumble { padding: 6px 9px; border: 1px solid currentColor; border-radius: var(--r-sm); }
.dice-roll-result--crit { color: var(--warning); background: color-mix(in srgb, var(--warning) 8%, transparent); }
.dice-roll-result--fumble { color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, transparent); }
.dice-roll-result-outcome { font-size: 11px; font-weight: 700; }
</style>
