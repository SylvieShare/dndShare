<template>
  <div class="dice-pop" :class="{ 'dice-pop--crit': hasSettledOutcome(entry, 'crit'), 'dice-pop--fumble': hasSettledOutcome(entry, 'fumble') }">
    <div v-if="entry.title" class="dice-pop-title">{{ entry.title }}</div>

    <div class="dice-pop-body">
      <div class="dice-pop-expr">
        <template v-for="(p, i) in entry.result.parts" :key="i">
          <span v-if="i !== 0 || p.sign === '-'" class="dice-pop-sign">{{ p.sign }}</span>
          <span
            v-if="p.kind === 'dice'"
            class="dice-pop-rolls"
            :style="p.color ? { color: p.color } : null"
          >
            <template v-for="(r, ri) in p.rolls" :key="ri">
              <span v-if="ri > 0" class="dice-pop-rolls-plus">+</span>
              <span
                class="dice-pop-roll-wrap"
                :class="{
                  'dice-pop-roll--drop': p.dropped && p.dropped.includes(ri) && !isRolling(entry.id),
                  'dice-pop-roll--rolling': isRolling(entry.id),
                }"
              >
                <SystemDie
                  :sides="p.sides"
                  :value="displayedRoll(entry, i, ri, r)"
                  :size="38"
                  :color="p.color || entry.color || 'var(--accent)'"
                />
              </span>
            </template>
          </span>
          <span
            v-else
            class="dice-pop-flat"
            :style="p.color ? { color: p.color } : null"
          >{{ p.value }}</span>
        </template>
      </div>

      <div class="dice-pop-sep" />

      <Transition name="dice-result" mode="out-in">
        <div
          v-if="entry.outcome && !isRolling(entry.id)"
          :key="entry.outcome.kind"
          class="dice-pop-outcome"
          :class="`dice-pop-outcome--${entry.outcome.kind}`"
        >
          <span class="dice-pop-outcome-label">{{ entry.outcome.kind === 'crit' ? 'КРИТ' : 'ПРОВАЛ' }}</span>
          <span class="dice-pop-outcome-val">{{ entry.outcome.value }}</span>
        </div>
        <div
          v-else
          :key="isTotalRolling(entry.id) ? 'rolling' : 'settled'"
          class="dice-pop-total"
          :class="{ 'dice-pop-total--rolling': isTotalRolling(entry.id) }"
        >{{ displayedTotal(entry) }}</div>
      </Transition>
    </div>

    <div v-if="hasMultipleTypes(entry)" class="dice-pop-types">
      <div
        v-for="(t, i) in entry.result.byType"
        :key="i"
        class="dice-pop-type"
      >
        <span
          class="dice-pop-type-name"
          :style="t.color ? { color: t.color } : null"
        >{{ t.label || 'обычный' }}</span>
        <span class="dice-pop-type-val">{{ t.value }}</span>
      </div>
    </div>

    <div class="dice-pop-raw">{{ rawExpression(entry) }}</div>
    <RollOutcomeNote v-if="!isRolling(entry.id)" :note="entry.result.note" />

    <div v-if="entry.result.adjustments?.length && !isRolling(entry.id)" class="dice-pop-adjustments">
      <div v-for="adjustment in entry.result.adjustments" :key="`${adjustment.kind}:${adjustment.label}`">
        <span>{{ adjustment.label }}</span>
        <strong>{{ adjustment.original }} → {{ adjustment.value }}</strong>
      </div>
    </div>

    <div v-if="entry.actions?.length && !isRolling(entry.id)" class="dice-pop-actions">
      <ActionButton v-for="action in entry.actions" :key="action.key" variant="quiet" @click="emit('action', action.key)">
        {{ action.label }}
      </ActionButton>
    </div>
  </div>
</template>
<script setup>
import { onBeforeUnmount, watch } from 'vue'
import { useDiceRollAnimation } from '@/shared/composables/useDiceRollAnimation'
import SystemDie from '@/shared/ui/SystemDie.vue'
import RollOutcomeNote from '@/shared/ui/RollOutcomeNote.vue'
import { ActionButton } from '@sylvieshare/share-ui'
const props = defineProps({ entry: { type: Object, required: true } })
const emit = defineEmits(['action'])
function shouldAnimateRolls() {
  return typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
const { displayedRoll, displayedTotal, startEntryAnimation, clearEntryAnimation, isRolling, isTotalRolling, dispose } = useDiceRollAnimation({ shouldAnimate: shouldAnimateRolls })
watch(() => props.entry.id, (id, previous) => {
  if (previous != null) clearEntryAnimation(previous)
  startEntryAnimation(props.entry)
}, { immediate: true })
onBeforeUnmount(dispose)
function hasMultipleTypes(entry) { return (entry?.result?.byType?.length || 0) > 1 }
function hasSettledOutcome(entry, kind) { return entry.outcome?.kind === kind && !isRolling(entry.id) }
function rawExpression(entry) { return (entry?.result?.expression || '').replace(/\{([^|}]*)\|[^}]*\}/g, '{$1}') }
</script>
<style scoped>
.dice-pop--crit .dice-pop-outcome { animation: dice-pop-crit-settle .52s ease; }
.dice-pop--fumble .dice-pop-outcome { animation: dice-pop-fumble-settle .52s ease; }
.dice-pop-actions { display: flex; gap: 6px; margin-top: 9px; }

.dice-pop-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 8px;
  padding-right: 22px;
  letter-spacing: 0.01em;
}
.dice-pop--crit .dice-pop-title { color: var(--warning); }
.dice-pop--fumble .dice-pop-title { color: var(--danger); }

.dice-pop-body {
  display: flex;
  align-items: stretch;
  gap: 12px;
}

.dice-pop-expr {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: var(--text-1);
  align-self: center;
}

.dice-pop-sep {
  width: 1px;
  background: var(--border-strong);
  flex-shrink: 0;
}

.dice-pop-sign  { color: color-mix(in srgb, var(--text-1) 55%, transparent); font-weight: 700; }
.dice-pop-rolls {
  color: var(--text-1);
  font-weight: 700;
  letter-spacing: 0.02em;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.dice-pop-rolls-plus {
  display: inline-flex;
  align-items: center;
  height: 38px;
  margin: 0 2px;
  color: color-mix(in srgb, var(--text-1) 55%, transparent);
}
.dice-pop-roll-wrap  { display: inline-flex; vertical-align: middle; white-space: nowrap; }
.dice-pop-roll--rolling {
  opacity: 0.56;
  filter: saturate(0.45);
  transform-origin: center;
  animation: dice-pop-roll-tumble 0.56s cubic-bezier(0.22, 0.78, 0.2, 1) both;
}
.dice-pop-roll--drop {
  position: relative;
  opacity: 0.38;
  filter: grayscale(0.8);
}
.dice-pop-roll--drop::after {
  content: '';
  position: absolute;
  left: 2px;
  right: 2px;
  top: 50%;
  height: 2px;
  border-radius: 2px;
  background: currentColor;
  transform: rotate(-22deg);
}
.dice-pop-flat { color: color-mix(in srgb, var(--text-1) 55%, transparent); font-weight: 600; }
.dice-pop-total {
  flex-shrink: 0;
  align-self: center;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1;
  letter-spacing: -0.02em;
  min-width: 44px;
  text-align: center;
}
.dice-pop-total--rolling {
  opacity: 0.56;
  filter: saturate(0.45);
  text-shadow: 0 0 12px color-mix(in srgb, var(--accent) 42%, transparent);
}

.dice-result-enter-active,
.dice-result-leave-active {
  transition: opacity 0.16s ease, transform 0.2s cubic-bezier(0.2, 0.9, 0.25, 1.15), filter 0.16s ease;
}
.dice-result-enter-from {
  opacity: 0;
  transform: scale(0.72);
  filter: blur(3px);
}
.dice-result-leave-to {
  opacity: 0;
  transform: scale(1.16);
  filter: blur(2px);
}

.dice-pop-outcome {
  flex-shrink: 0;
  align-self: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 14px;
  border-radius: 10px;
  border: 2px solid;
  min-width: 56px;
}
.dice-pop-outcome-label {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.18em;
}
.dice-pop-outcome-val {
  font-size: 30px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
}

.dice-pop-outcome--crit {
  border-color: var(--warning);
  background: linear-gradient(135deg, color-mix(in srgb, var(--warning) 18%, transparent), color-mix(in srgb, var(--warning) 4%, transparent));
  box-shadow: 0 0 14px color-mix(in srgb, var(--warning) 25%, transparent), inset 0 0 10px color-mix(in srgb, var(--warning) 12%, transparent);
}
.dice-pop-outcome--crit .dice-pop-outcome-label { color: var(--warning); }
.dice-pop-outcome--crit .dice-pop-outcome-val {
  color: var(--warning);
  text-shadow: 0 0 8px color-mix(in srgb, var(--warning) 40%, transparent);
}

.dice-pop-outcome--fumble {
  border-color: var(--danger);
  background: linear-gradient(135deg, color-mix(in srgb, var(--danger) 18%, transparent), color-mix(in srgb, var(--danger) 4%, transparent));
  box-shadow: 0 0 14px color-mix(in srgb, var(--danger) 22%, transparent), inset 0 0 10px color-mix(in srgb, var(--danger) 12%, transparent);
}
.dice-pop-outcome--fumble .dice-pop-outcome-label { color: var(--danger); }
.dice-pop-outcome--fumble .dice-pop-outcome-val {
  color: var(--danger);
  text-shadow: 0 0 8px color-mix(in srgb, var(--danger) 40%, transparent);
}

.dice-pop-types {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.dice-pop-type {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}
.dice-pop-type-name { color: var(--text-2); font-weight: 600; }
.dice-pop-type-val  { color: var(--text-1); font-weight: 700; }

.dice-pop-raw {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 8px;
  overflow-wrap: anywhere;
}
.dice-pop-adjustments { display: grid; gap: 5px; margin-top: 8px; }
.dice-pop-adjustments > div { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 8px; border-radius: var(--r-sm); background: color-mix(in srgb, var(--success) 11%, transparent); color: var(--text-2); font-size: 11px; }
.dice-pop-adjustments strong { color: var(--success); font-size: 12px; }

@keyframes dice-pop-roll-tumble {
  0%   { transform: translateY(0) rotate(0deg) scale(0.9); }
  18%  { transform: translateY(-5px) rotate(-14deg) scale(1.06); }
  38%  { transform: translateY(2px) rotate(11deg) scale(0.96); }
  58%  { transform: translateY(-3px) rotate(-8deg) scale(1.03); }
  78%  { transform: translateY(1px) rotate(5deg) scale(0.99); }
  100% { transform: translateY(0) rotate(0deg) scale(1); }
}

@keyframes dice-pop-crit-settle {
  0% {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-lg);
  }
  48% {
    border-color: var(--warning);
    box-shadow: 0 14px 40px var(--scrim), 0 0 0 3px color-mix(in srgb, var(--warning) 68%, transparent), 0 0 34px color-mix(in srgb, var(--warning) 42%, transparent);
  }
}

@keyframes dice-pop-fumble-settle {
  0% {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-lg);
  }
  48% {
    border-color: var(--danger);
    box-shadow: 0 14px 40px var(--scrim), 0 0 0 3px color-mix(in srgb, var(--danger) 64%, transparent), 0 0 34px color-mix(in srgb, var(--danger) 38%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dice-pop--crit,
  .dice-pop--fumble,
  .dice-pop-roll--rolling,
  .dice-result-enter-active,
  .dice-result-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
