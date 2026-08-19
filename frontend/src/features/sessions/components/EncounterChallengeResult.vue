<template>
  <div
    class="ecr-result"
    :class="{
      'ecr-result--critical': result.roll === 20 && !isRolling(animationId),
      'ecr-result--fumble': result.roll === 1 && !isRolling(animationId),
      'ecr-result--rolling': isRolling(animationId),
    }"
    :aria-label="ariaLabel"
  >
    <div class="ecr-event">
      <span class="ecr-title">{{ eventTitle }}</span>
      <div class="ecr-rerolls" aria-label="Докинуть кубик">
        <button
          class="ecr-reroll-btn ecr-reroll-btn--advantage"
          type="button"
          title="Докинуть с преимуществом"
          aria-label="Докинуть с преимуществом"
          @click.stop="$emit('reroll', 'advantage')"
        >
          <ArrowUp :size="13" :stroke-width="2.5" />
        </button>
        <button
          class="ecr-reroll-btn ecr-reroll-btn--disadvantage"
          type="button"
          title="Докинуть с помехой"
          aria-label="Докинуть с помехой"
          @click.stop="$emit('reroll', 'disadvantage')"
        >
          <ArrowDown :size="13" :stroke-width="2.5" />
        </button>
      </div>
    </div>

    <div class="ecr-values" :class="{ 'ecr-values--double': hasExtraRoll }">
      <span
        v-for="(natural, rollIndex) in naturalRolls"
        :key="rollIndex"
        class="ecr-die"
        :class="{
          'ecr-die--rolling': isNaturalRolling(rollIndex),
          'ecr-die--dropped': isNaturalDropped(rollIndex),
        }"
      >
        <SystemDie
          :sides="20"
          :value="displayedNatural(rollIndex, natural)"
          :size="hasExtraRoll ? 34 : 48"
          :color="resultColor"
        />
      </span>
      <template v-if="result.bonus">
        <span class="ecr-operator">{{ result.bonus > 0 ? '+' : '−' }}</span>
        <span class="ecr-bonus">{{ Math.abs(result.bonus) }}</span>
      </template>
      <span class="ecr-equals">=</span>
      <strong class="ecr-total" :class="{ 'ecr-total--rolling': isTotalRolling(animationId) }">
        {{ displayedTotalValue }}
      </strong>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, useId, watch } from 'vue'
import { ArrowDown, ArrowUp } from '@lucide/vue'
import { useDiceRollAnimation } from '@/shared/composables/useDiceRollAnimation'
import SystemDie from '@/shared/ui/SystemDie.vue'

const props = defineProps({
  challenge: { type: Object, required: true },
  ability: { type: Object, required: true },
  result: { type: Object, required: true },
})

defineEmits(['reroll'])

const SAVE_ABILITY_LABELS = {
  STR: 'силы',
  DEX: 'ловкости',
  CON: 'телосложения',
  INT: 'интеллекта',
  WIS: 'мудрости',
  CHA: 'харизмы',
}

function shouldAnimate() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const animationId = useId()
const naturalRolls = computed(() => {
  if (Array.isArray(props.result.rolls) && props.result.rolls.length === 2) {
    return props.result.rolls.map(roll => Number(roll) || 0)
  }
  return [Number(props.result.roll) || 0]
})
const droppedRolls = computed(() =>
  Array.isArray(props.result.dropped) ? props.result.dropped : []
)
const hasExtraRoll = computed(() => naturalRolls.value.length === 2)
const rollEntry = computed(() => {
  const bonus = Number(props.result.bonus) || 0
  const parts = [{
    sign: '+',
    kind: 'dice',
    sides: 20,
    rolls: naturalRolls.value,
    dropped: droppedRolls.value,
  }]
  if (bonus) {
    parts.push({
      sign: bonus < 0 ? '-' : '+',
      kind: 'flat',
      value: Math.abs(bonus),
    })
  }
  return {
    id: animationId,
    result: { parts, total: Number(props.result.total) || 0 },
  }
})

const {
  displayedRoll,
  displayedTotal,
  startEntryAnimation,
  isRolling,
  isTotalRolling,
  dispose,
} = useDiceRollAnimation({ shouldAnimate })

function displayedNatural(rollIndex, natural) {
  if (hasExtraRoll.value && rollIndex === 0) return natural
  return displayedRoll(rollEntry.value, 0, rollIndex, natural)
}

function isNaturalRolling(rollIndex) {
  return isRolling(animationId) && (!hasExtraRoll.value || rollIndex === 1)
}

function isNaturalDropped(rollIndex) {
  return !isRolling(animationId) && droppedRolls.value.includes(rollIndex)
}

const displayedTotalValue = computed(() => {
  if (hasExtraRoll.value && isRolling(animationId)) {
    const extra = naturalRolls.value[1]
    return displayedNatural(1, extra) + (Number(props.result.bonus) || 0)
  }
  return displayedTotal(rollEntry.value)
})

const eventTitle = computed(() => {
  const ability = SAVE_ABILITY_LABELS[props.ability.value] || props.ability.label.toLowerCase()
  return props.challenge.savingThrow
    ? `Спасбросок ${ability}`
    : `Проверка ${ability}`
})

const resultColor = computed(() => {
  if (isRolling(animationId)) return 'var(--accent)'
  if (props.result.roll === 20) return 'var(--warning)'
  if (props.result.roll === 1) return 'var(--danger)'
  return 'var(--accent)'
})

const ariaLabel = computed(() => {
  const rolls = hasExtraRoll.value ? `броски ${naturalRolls.value.join(' и ')}, ` : ''
  return `${eventTitle.value}: ${rolls}бонус ${props.result.bonus}, итог ${props.result.total}`
})

watch(
  () => [props.result.roll, props.result.bonus, props.result.total, props.result.revision],
  () => startEntryAnimation(rollEntry.value),
  { immediate: true },
)

onBeforeUnmount(dispose)
</script>

<style scoped>
.ecr-result {
  display: flex;
  height: 72px;
  min-height: 72px;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  overflow: hidden;
  padding: 7px 10px;
  border: 0;
  border-inline: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border));
  background: none;
  transition: border-color 0.18s;
}

.ecr-event {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.ecr-title {
  color: var(--text-1);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.045em;
  line-height: 1.15;
  text-transform: uppercase;
  white-space: normal;
  overflow-wrap: anywhere;
}

.ecr-rerolls {
  display: flex;
  align-items: center;
  gap: 5px;
}

.ecr-reroll-btn {
  display: inline-grid;
  width: 25px;
  height: 22px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
  border-radius: 7px;
  place-items: center;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--surface) 76%, transparent);
  cursor: pointer;
  transition: color 0.14s, border-color 0.14s, background 0.14s, transform 0.14s;
}

.ecr-reroll-btn:hover {
  color: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 62%, var(--border));
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
}

.ecr-reroll-btn:active { transform: translateY(1px); }

.ecr-reroll-btn--disadvantage:hover {
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 52%, var(--border));
  background: color-mix(in srgb, var(--danger) 11%, var(--surface));
}

.ecr-values {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  font-variant-numeric: tabular-nums;
}

.ecr-die {
  position: relative;
  display: inline-flex;
  transition: opacity 0.16s, filter 0.16s, transform 0.18s;
}

.ecr-die--rolling {
  opacity: 0.72;
  filter: saturate(0.68);
  transform: scale(0.96);
}

.ecr-die--dropped {
  opacity: 0.36;
  filter: grayscale(0.82);
}

.ecr-die--dropped::after {
  position: absolute;
  top: 50%;
  right: 1px;
  left: 1px;
  height: 2px;
  border-radius: 2px;
  background: currentColor;
  content: '';
  transform: rotate(-22deg);
}

.ecr-values--double { gap: 2px; }

.ecr-values--double .ecr-total {
  min-width: 29px;
  font-size: 22px;
}

.ecr-values--double .ecr-bonus {
  min-width: 10px;
  font-size: 14px;
}

.ecr-values--double .ecr-operator,
.ecr-values--double .ecr-equals { font-size: 12px; }

.ecr-operator,
.ecr-equals {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 750;
}

.ecr-bonus {
  min-width: 12px;
  color: var(--text-2);
  font-size: 15px;
  font-weight: 750;
  text-align: center;
}

.ecr-total {
  min-width: 35px;
  color: var(--accent-soft);
  font-size: 25px;
  font-weight: 850;
  letter-spacing: -0.025em;
  line-height: 1;
  text-align: right;
  transition: opacity 0.15s, filter 0.15s;
}

.ecr-total--rolling {
  opacity: 0.58;
  filter: saturate(0.55);
}

.ecr-result--rolling {
  border-inline-color: color-mix(in srgb, var(--accent) 72%, var(--border));
}

.ecr-result--critical {
  border-inline-color: color-mix(in srgb, var(--warning) 64%, var(--border));
}

.ecr-result--critical .ecr-total { color: var(--warning); }

.ecr-result--fumble {
  border-inline-color: color-mix(in srgb, var(--danger) 58%, var(--border));
}

.ecr-result--fumble .ecr-total { color: var(--danger); }

@media (prefers-reduced-motion: reduce) {
  .ecr-result,
  .ecr-die,
  .ecr-total { transition: none; }
}
</style>
