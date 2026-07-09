<template>
  <Teleport to="body">
  <TransitionGroup name="dice-stack" tag="div" class="dice-pop-stack">
    <div
      v-for="entry in store.stack"
      :key="entry.id"
      class="dice-pop"
      :class="{
        'dice-pop--crit': entry.outcome?.kind === 'crit',
        'dice-pop--fumble': entry.outcome?.kind === 'fumble',
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
              <span class="dice-pop-rolls-br">[</span>
              <template v-for="(r, ri) in p.rolls" :key="ri">
                <span v-if="ri > 0" class="dice-pop-rolls-plus">+</span>
                <span
                  class="dice-pop-roll"
                  :class="{ 'dice-pop-roll--drop': p.dropped && p.dropped.includes(ri) }"
                >{{ r }}</span>
              </template>
              <span class="dice-pop-rolls-br">]</span>
            </span>
            <span
              v-else
              class="dice-pop-flat"
              :style="p.color ? { color: p.color } : null"
            >{{ p.value }}</span>
          </template>
        </div>

        <div class="dice-pop-sep" />

        <div
          v-if="entry.outcome"
          class="dice-pop-outcome"
          :class="`dice-pop-outcome--${entry.outcome.kind}`"
        >
          <span class="dice-pop-outcome-label">{{ entry.outcome.kind === 'crit' ? 'КРИТ' : 'ПРОВАЛ' }}</span>
          <span class="dice-pop-outcome-val">{{ entry.outcome.value }}</span>
        </div>
        <div v-else class="dice-pop-total">{{ entry.result.total }}</div>
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
import { useDiceStore } from '@/stores/dice'

const store = useDiceStore()

function hasMultipleTypes(entry) {
  return (entry?.result?.byType?.length || 0) > 1
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
  background: var(--popup-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  padding: 12px 14px 14px;
  color: var(--text-1);
  font-size: 13px;
  overflow: hidden;
}

.dice-pop--crit {
  border-color: #f5b94a;
  box-shadow: 0 14px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,185,74,0.5), 0 0 22px rgba(245,185,74,0.25);
}
.dice-pop--fumble {
  border-color: #e84a4a;
  box-shadow: 0 14px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(232,74,74,0.5), 0 0 22px rgba(232,74,74,0.22);
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
.dice-pop-close:hover { color: var(--text-1); background: rgba(255,255,255,0.06); }

.dice-pop-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 8px;
  padding-right: 22px;
  letter-spacing: 0.01em;
}
.dice-pop--crit .dice-pop-title { color: #ffd97a; }
.dice-pop--fumble .dice-pop-title { color: #ff9a9a; }

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

.dice-pop-sign  { color: rgba(232,232,239,0.55); font-weight: 700; }
.dice-pop-rolls {
  color: var(--text-1);
  font-weight: 700;
  letter-spacing: 0.02em;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.dice-pop-rolls-br   { color: rgba(232,232,239,0.55); }
.dice-pop-rolls-plus { color: rgba(232,232,239,0.55); margin: 0 2px; }
.dice-pop-roll       { white-space: nowrap; }
.dice-pop-roll--drop {
  color: rgba(232,232,239,0.35);
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
  font-weight: 600;
}
.dice-pop-flat { color: rgba(232,232,239,0.55); font-weight: 600; }
.dice-pop-tag {
  margin-left: 2px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 1px 5px;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  color: var(--text-2);
}

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
  border-color: #f5b94a;
  background: linear-gradient(135deg, rgba(245,185,74,0.18), rgba(245,185,74,0.04));
  box-shadow: 0 0 14px rgba(245,185,74,0.25), inset 0 0 10px rgba(245,185,74,0.12);
}
.dice-pop-outcome--crit .dice-pop-outcome-label { color: #f5b94a; }
.dice-pop-outcome--crit .dice-pop-outcome-val {
  color: #ffd97a;
  text-shadow: 0 0 8px rgba(245,185,74,0.4);
}

.dice-pop-outcome--fumble {
  border-color: #e84a4a;
  background: linear-gradient(135deg, rgba(232,74,74,0.18), rgba(232,74,74,0.04));
  box-shadow: 0 0 14px rgba(232,74,74,0.22), inset 0 0 10px rgba(232,74,74,0.12);
}
.dice-pop-outcome--fumble .dice-pop-outcome-label { color: #e84a4a; }
.dice-pop-outcome--fumble .dice-pop-outcome-val {
  color: #ff9a9a;
  text-shadow: 0 0 8px rgba(232,74,74,0.4);
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
.dice-pop--crit .dice-pop-bar { background: #f5b94a; }
.dice-pop--fumble .dice-pop-bar { background: #e84a4a; }

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
</style>
