<template>
  <div class="dice-panel">
    <div class="dice-panel-head">
      <span class="dice-panel-title">Кубики</span>
    </div>
    <div class="dice-panel-body">
      <div class="dice-panel-body-inner">
        <MultiToggle v-model="mode" :options="modeOptions" :neutral-value="'normal'" block />
        <div class="dice-panel-grid">
          <button
            v-for="die in SYSTEM_DICE"
            :key="die.id"
            type="button"
            class="dice-panel-die"
            :title="`Бросить ${die.value}`"
            :aria-keyshortcuts="`Alt+Shift+${diceShortcutNumber(die.sides)}`"
            @click="rollDie(die.sides)"
          >
            <SystemDie :sides="die.sides" :size="44" color="var(--accent)" />
            <kbd v-if="showShortcutHints" class="dice-panel-shortcut">{{ diceShortcut(die.sides) }}</kbd>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { MultiToggle } from '@sylvieshare/share-ui'
import SystemDie from '@/shared/ui/SystemDie.vue'
import { useDiceStore } from '@/stores/dice'
import { SYSTEM_DICE } from '@/shared/lib/systemDice'
import { SESSION_DICE_SHORTCUTS, sessionShortcutLabels } from '@/features/sessions/lib/sessionShortcuts'

defineProps({ showShortcutHints: { type: Boolean, default: false } })

const modeOptions = [
  { value: 'disadvantage', label: 'Помеха' },
  { value: 'normal',       label: 'Норм' },
  { value: 'advantage',    label: 'Преимущество' },
]

const mode = ref('normal')
const diceStore = useDiceStore()
const shortcutLabels = sessionShortcutLabels()

function diceShortcut(sides) {
  const number = diceShortcutNumber(sides)
  return number ? `${shortcutLabels.dice}+${number}` : ''
}

function diceShortcutNumber(sides) {
  const index = SESSION_DICE_SHORTCUTS.findIndex(shortcut => shortcut.sides === sides)
  return index < 0 ? '' : index + 1
}

function rollOne(sides) {
  return Math.floor(Math.random() * sides) + 1
}

function rollDie(sides) {
  if (mode.value === 'normal') {
    diceStore.roll(`d${sides}`, `d${sides}`)
    return
  }
  const keepHigh = mode.value === 'advantage'
  const a = rollOne(sides)
  const b = rollOne(sides)
  const winnerIdx = (keepHigh ? a >= b : a <= b) ? 0 : 1
  const droppedIdx = winnerIdx === 0 ? 1 : 0
  const winner = winnerIdx === 0 ? a : b
  const title = keepHigh ? `d${sides} с преимуществом` : `d${sides} с помехой`
  diceStore.pushEntry({
    title,
    result: {
      parts: [{
        sign: '+',
        kind: 'dice',
        n: 2,
        sides,
        rolls: [a, b],
        sum: winner,
        dropped: [droppedIdx],
        label: null,
        color: null,
      }],
      total: winner,
      byType: [{ label: null, color: null, value: winner }],
      expression: `2d${sides}${keepHigh ? 'kh' : 'kl'}`,
    },
  })
}

defineExpose({ rollDie })
</script>

<style scoped>
.dice-panel {
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
}

.dice-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 22px;
}

.dice-panel-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.dice-panel-body {
  display: grid;
  grid-template-rows: 1fr;
  padding-top: 10px;
}
.dice-panel-body-inner {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dice-panel-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.dice-panel-die {
  position: relative;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 0;
  color: var(--text-1);
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background 0.12s, border-color 0.15s, transform 0.08s, color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dice-panel-shortcut {
  position: absolute;
  top: 3px;
  right: 4px;
  padding: 1px 3px;
  border: 0;
  border-radius: 4px;
  background: color-mix(in srgb, var(--popover-bg) 86%, transparent);
  color: var(--accent-soft);
  font: 750 8px/1.25 var(--font-ui);
  pointer-events: none;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--scrim) 38%, transparent);
  animation: dice-shortcut-hint-in .16s cubic-bezier(.22, 1, .36, 1) both;
}
@keyframes dice-shortcut-hint-in {
  from { opacity: 0; transform: translateY(-2px); }
}
.dice-panel-die:hover {
  border-color: var(--accent);
  color: var(--text-on-accent);
  background: var(--surface-active);
}
.dice-panel-die:active { transform: scale(0.96); }
@media (prefers-reduced-motion: reduce) {
  .dice-panel-shortcut { animation: none; }
}
</style>
