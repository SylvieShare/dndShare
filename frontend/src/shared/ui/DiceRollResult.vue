<template>
  <div class="dice-roll-result" :class="outcomeKind ? `dice-roll-result--${outcomeKind}` : ''" :aria-label="`Результат броска: ${result.total}${outcomeLabel ? `, ${outcomeLabel}` : ''}`">
    <template v-for="(part, index) in result.parts || []" :key="index">
      <span v-if="index || part.sign === '-'">{{ part.sign || '+' }}</span>
      <template v-if="part.kind === 'dice'">
        <template v-for="(value, i) in part.rolls" :key="i">
          <span v-if="i">+</span>
          <span :class="{ 'dice-roll-result-dropped': part.dropped?.includes(i) || (part.keptIndex != null && part.keptIndex !== i) }" :title="part.dropped?.includes(i) || (part.keptIndex != null && part.keptIndex !== i) ? 'Не учитывается' : ''">
          <SystemDie :sides="part.sides" :value="value" :size="size" :animated="false" :color="part.color || color || result.color || 'var(--accent-soft)'" />
          </span>
        </template>
      </template>
      <span v-else :style="{ color: part.color || color || result.color }">{{ part.value }}</span>
    </template>
    <strong>= {{ result.total }}</strong>
    <span v-if="outcomeLabel" class="dice-roll-result-outcome">{{ outcomeLabel }}</span>
  </div>
</template>
<script setup>
import SystemDie from './SystemDie.vue'
import { computed } from 'vue'
const props = defineProps({ result: { type: Object, required: true }, outcome: { type: Object, default: null }, size: { type: Number, default: 28 }, color: { type: String, default: '' } })
const outcomeKind = computed(() => ['crit', 'fumble'].includes(props.outcome?.kind) ? props.outcome.kind : '')
const outcomeLabel = computed(() => ({ crit: 'Критический успех', fumble: 'Критический провал' })[outcomeKind.value] || '')
</script>
<style scoped>
.dice-roll-result { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; color: var(--text-2); }
.dice-roll-result strong { white-space: nowrap; color: var(--text-1); font-size: 16px; margin-left: 3px; }
.dice-roll-result-dropped { opacity: .35; text-decoration: line-through; }
.dice-roll-result--crit, .dice-roll-result--fumble { padding: 6px 9px; border: 1px solid currentColor; border-radius: var(--r-sm); }
.dice-roll-result--crit { color: var(--warning); background: color-mix(in srgb, var(--warning) 8%, transparent); }
.dice-roll-result--fumble { color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, transparent); }
.dice-roll-result-outcome { font-size: 11px; font-weight: 700; }
</style>
