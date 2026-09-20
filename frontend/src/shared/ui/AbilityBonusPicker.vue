<template>
  <section class="ability-bonus-picker" :aria-label="title">
    <div class="ability-bonus-heading">
      <h3>{{ title }}</h3>
      <span class="ability-bonus-count" :class="{ complete }" aria-live="polite">{{ selectedCount }} / {{ pattern.length }}</span>
    </div>
    <MultiToggle v-if="patterns.length > 1" :options="modes" :model-value="mode" aria-label="Распределение прибавок" block @update:model-value="changeMode" />
    <p v-if="patterns.length > 1" class="ability-bonus-hint">Выберите разные характеристики. Смена распределения сбрасывает прибавки.</p>
    <fieldset v-for="group in groups" :key="group.bonus" class="ability-bonus-group">
      <legend>+{{ group.bonus }} · выберите {{ group.count }} {{ group.count === 1 ? 'характеристику' : 'характеристики' }}</legend>
      <div class="ability-bonus-options">
        <button
          v-for="stat in abilities" :key="stat" type="button"
          class="ability-bonus-option" :class="{ selected: Number(modelValue[stat]) === group.bonus }"
          :aria-label="`${STAT_FULL[stat]} +${group.bonus}`"
          :aria-pressed="Number(modelValue[stat]) === group.bonus"
          :disabled="unavailable(stat, group.bonus)"
          :title="scores && Number(scores[stat]) + group.bonus > maximum ? `Максимум — ${maximum}` : STAT_FULL[stat]"
          @click="toggle(stat, group.bonus)"
        ><span>{{ STAT_SHORT[stat] }}<small v-if="scores">{{ scores[stat] }}<template v-if="Number(modelValue[stat]) === group.bonus"> → {{ Number(scores[stat]) + group.bonus }}</template></small></span><b>+{{ group.bonus }}</b></button>
      </div>
    </fieldset>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { MultiToggle } from '@sylvieshare/share-ui'
import { STAT_KEYS, STAT_FULL, STAT_SHORT } from '@/shared/lib/dndStats'
import { bonusGroups, normalizeBonusSelection, toggleBonusSelection, validBonusSelection } from '@/shared/lib/abilityBonusChoice'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  abilities: { type: Array, default: () => STAT_KEYS },
  patterns: { type: Array, required: true },
  title: { type: String, default: 'Прибавки к характеристикам' },
  scores: { type: Object, default: null },
  maximum: { type: Number, default: 20 },
})
const emit = defineEmits(['update:modelValue'])
const mode = ref('0')
const pattern = computed(() => props.patterns[Number(mode.value)] || props.patterns[0] || [])
const groups = computed(() => bonusGroups(pattern.value))
const modes = computed(() => props.patterns.map((value, index) => ({ value: String(index), label: value.map(bonus => `+${bonus}`).join(' / ') })))
const selectedCount = computed(() => Object.values(props.modelValue).filter(value => Number(value) > 0).length)
const complete = computed(() => selectedCount.value === pattern.value.length && validBonusSelection(props.modelValue, props.abilities, pattern.value))

watch(() => [props.modelValue, props.abilities, props.patterns, props.scores, props.maximum], () => {
  const withinCap = Object.fromEntries(Object.entries(props.modelValue).filter(([stat, bonus]) => !props.scores || Number(props.scores[stat]) + Number(bonus) <= props.maximum))
  if (Object.keys(withinCap).length !== Object.keys(props.modelValue).length) { emit('update:modelValue', withinCap); return }
  if (validBonusSelection(props.modelValue, props.abilities, pattern.value)) return
  const matching = props.patterns.findIndex(value => validBonusSelection(props.modelValue, props.abilities, value))
  if (matching >= 0) mode.value = String(matching)
  else emit('update:modelValue', normalizeBonusSelection(props.modelValue, props.abilities, pattern.value))
}, { deep: true, immediate: true })

function changeMode(value) {
  if (mode.value === value) return
  mode.value = value
  emit('update:modelValue', {})
}
function unavailable(stat, bonus) {
  return Number(props.modelValue[stat]) !== bonus && (
    (props.scores && Number(props.scores[stat]) + bonus > props.maximum)
    || toggleBonusSelection(props.modelValue, stat, bonus, props.abilities, pattern.value) === props.modelValue
  )
}
function toggle(stat, bonus) {
  if (unavailable(stat, bonus)) return
  const next = toggleBonusSelection(props.modelValue, stat, bonus, props.abilities, pattern.value)
  if (next !== props.modelValue) emit('update:modelValue', next)
}
</script>

<style scoped>
.ability-bonus-picker { display: flex; flex-direction: column; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: var(--r-md); background: color-mix(in srgb, var(--surface) 68%, transparent); }
.ability-bonus-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ability-bonus-heading h3 { margin: 0; color: var(--text-1); font-family: var(--font-display); font-size: 17px; }
.ability-bonus-count { color: var(--text-muted); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ability-bonus-count.complete { color: var(--success); }
.ability-bonus-hint { margin: 0; color: var(--text-muted); font-size: 12px; line-height: 1.4; }
.ability-bonus-group { min-width: 0; margin: 0; padding: 0; border: 0; }
.ability-bonus-group legend { margin-bottom: 8px; color: var(--text-2); font-size: 12px; }
.ability-bonus-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(84px, 1fr)); gap: 8px; }
.ability-bonus-option { min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-raised); color: var(--text-1); font: inherit; cursor: pointer; }
.ability-bonus-option b { color: var(--accent); }
.ability-bonus-option small { display: block; font-size: 11px; opacity: .8; }
.ability-bonus-option.selected { border-color: var(--accent); background: var(--accent); color: var(--text-on-accent); }
.ability-bonus-option.selected b { color: inherit; }
.ability-bonus-option:disabled { opacity: .4; cursor: default; }
.ability-bonus-option:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
</style>
