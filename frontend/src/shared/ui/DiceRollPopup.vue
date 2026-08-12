<template>
  <Teleport to="body">
  <TransitionGroup name="dice-stack" tag="div" class="dice-pop-stack">
    <div
      v-for="entry in store.stack"
      :key="entry.id"
      class="dice-pop"
      :class="{
        'dice-pop--crit': hasSettledOutcome(entry, 'crit'),
        'dice-pop--fumble': hasSettledOutcome(entry, 'fumble'),
        'dice-pop--rolling': isRolling(entry.id),
      }"
    >
      <button class="dice-pop-close" @click="store.dismiss(entry.id)" aria-label="Закрыть">×</button>

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
                    'dice-pop-roll--drop': p.dropped && p.dropped.includes(ri),
                    'dice-pop-roll--rolling': isRolling(entry.id),
                  }"
                >
                  <SystemDie :sides="p.sides" :value="displayedRoll(entry, i, ri, r)" :size="38" :color="p.color" />
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
            :key="isRolling(entry.id) ? 'rolling' : 'settled'"
            class="dice-pop-total"
            :class="{ 'dice-pop-total--rolling': isRolling(entry.id) }"
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

      <div class="dice-pop-bar" :style="{ animationDuration: entry.duration + 'ms' }" />
    </div>
  </TransitionGroup>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, watch } from 'vue'
import { useDiceStore } from '@/stores/dice'
import { useDiceRollAnimation } from '@/shared/composables/useDiceRollAnimation'
import SystemDie from '@/shared/ui/SystemDie.vue'

const store = useDiceStore()

function shouldAnimateRolls() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(max-width: 640px)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const {
  displayedRoll,
  displayedTotal,
  startEntryAnimation,
  clearEntryAnimation,
  isRolling,
  dispose: disposeRollAnimation,
} = useDiceRollAnimation({ shouldAnimate: shouldAnimateRolls })

watch(
  () => store.stack.map(entry => entry.id),
  (ids, previousIds = []) => {
    const activeIds = new Set(ids)
    previousIds.filter(id => !activeIds.has(id)).forEach(clearEntryAnimation)
    ids.filter(id => !previousIds.includes(id)).forEach(id => {
      const entry = store.stack.find(item => item.id === id)
      if (entry) startEntryAnimation(entry)
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  disposeRollAnimation()
})

function hasMultipleTypes(entry) {
  return (entry?.result?.byType?.length || 0) > 1
}

function hasSettledOutcome(entry, kind) {
  return entry.outcome?.kind === kind && !isRolling(entry.id)
}

function rawExpression(entry) {
  const expr = entry?.result?.expression || ''
  return expr.replace(/\{([^|}]*)\|[^}]*\}/g, '{$1}')
}
</script>

<style scoped>
.dice-pop-stack {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  pointer-events: none;
  max-width: 380px;
}

.dice-pop {
  position: relative;
  pointer-events: auto;
  min-width: 260px;
  max-width: 380px;
  background: var(--popover-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  padding: 12px 14px 14px;
  color: var(--text-1);
  font-size: 13px;
  overflow: hidden;
}

.dice-pop--crit {
  border-color: var(--warning);
  box-shadow: 0 14px 40px var(--scrim), 0 0 0 1px color-mix(in srgb, var(--warning) 50%, transparent), 0 0 22px color-mix(in srgb, var(--warning) 25%, transparent);
  animation: dice-pop-crit-settle 0.52s cubic-bezier(0.2, 0.9, 0.25, 1.15);
}
.dice-pop--fumble {
  border-color: var(--danger);
  box-shadow: 0 14px 40px var(--scrim), 0 0 0 1px color-mix(in srgb, var(--danger) 50%, transparent), 0 0 22px color-mix(in srgb, var(--danger) 22%, transparent);
  animation: dice-pop-fumble-settle 0.52s cubic-bezier(0.2, 0.9, 0.25, 1.15);
}
.dice-pop--rolling {
  border-color: color-mix(in srgb, var(--accent) 72%, var(--border-strong));
  box-shadow: var(--shadow-lg), 0 0 18px color-mix(in srgb, var(--accent) 24%, transparent);
}

.dice-pop-close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.dice-pop-close:hover { color: var(--text-1); background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }

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
.dice-pop-rolls-plus { color: color-mix(in srgb, var(--text-1) 55%, transparent); margin: 0 2px; }
.dice-pop-roll-wrap  { display: inline-flex; white-space: nowrap; }
.dice-pop-roll--rolling {
  opacity: 0.56;
  filter: saturate(0.45);
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
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 8px;
  overflow-wrap: anywhere;
}

.dice-pop-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 100%;
  background: var(--accent);
  transform-origin: left center;
  animation: dice-pop-bar linear forwards;
}
.dice-pop--crit .dice-pop-bar { background: var(--warning); }
.dice-pop--fumble .dice-pop-bar { background: var(--danger); }

@keyframes dice-pop-bar {
  from { transform: scaleX(1); }
  to   { transform: scaleX(0); }
}

.dice-stack-enter-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
}
.dice-stack-leave-active {
  position: absolute;
  transition: transform 0.32s cubic-bezier(0.4, 0, 0.7, 0.2), opacity 0.32s ease;
}
.dice-stack-move {
  transition: transform 0.28s ease;
}
.dice-stack-enter-from { opacity: 0; transform: translate(8px, 8px); }
.dice-stack-leave-to   { opacity: 0; transform: translateX(120%); }

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
  .dice-result-enter-active,
  .dice-result-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
