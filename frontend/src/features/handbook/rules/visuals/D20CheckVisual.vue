<template>
  <BaseTile class="check-visual" color="var(--warning)" framed>
    <div class="check-controls">
      <span class="check-kicker">Проверка Скрытности · Лира</span>
      <MultiToggle v-model="mode" :options="modes" neutral-value="normal" aria-label="Режим броска" />
    </div>

    <div class="check-formula" aria-live="polite">
      <div class="check-dice">
        <SystemDie
          v-for="(value, index) in shownDice"
          :key="`${mode}-${index}`"
          :sides="20"
          :value="value"
          :size="64"
          :animated="false"
          :class="{ 'check-die--dropped': lastRoll?.dropped?.includes(index) }"
        />
        <span>{{ diceLabel }}</span>
      </div>
      <Plus aria-hidden="true" />
      <div class="check-number"><strong>+3</strong><span>Ловкость 16</span></div>
      <Plus aria-hidden="true" />
      <div class="check-number"><strong>+2</strong><span>Владение</span></div>
      <Equal aria-hidden="true" />
      <div class="check-total"><strong>{{ total }}</strong><span>итог</span></div>
    </div>

    <div class="check-footer">
      <span>{{ modeHint }}</span>
      <button type="button" @click="roll"><Dices aria-hidden="true" /> Бросить пример</button>
    </div>
  </BaseTile>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Dices, Equal, Plus } from '@lucide/vue'
import { BaseTile, MultiToggle } from '@sylvieshare/share-ui'
import SystemDie from '@/shared/ui/SystemDie'
import { useDiceStore } from '@/stores/dice'

const modes = [
  { value: 'disadvantage', label: 'Помеха' },
  { value: 'normal', label: 'Обычно' },
  { value: 'advantage', label: 'Преимущество' },
]

const mode = ref('normal')
const lastRoll = ref(null)
const diceStore = useDiceStore()

const defaultDice = computed(() => mode.value === 'normal' ? [12] : [12, mode.value === 'advantage' ? 17 : 7])
const shownDice = computed(() => lastRoll.value?.rolls || defaultDice.value)
const keptValue = computed(() => {
  if (!lastRoll.value) return mode.value === 'normal' ? 12 : (mode.value === 'advantage' ? 17 : 7)
  return lastRoll.value.kept
})
const total = computed(() => keptValue.value + 5)
const diceLabel = computed(() => mode.value === 'normal' ? 'один d20' : 'выбрать один')
const modeHint = computed(() => ({
  normal: 'Один d20 и все подходящие бонусы.',
  advantage: 'Два d20, используется больший. Результаты не складываются.',
  disadvantage: 'Два d20, используется меньший. Результаты не складываются.',
}[mode.value]))

function randomD20() {
  return Math.floor(Math.random() * 20) + 1
}

function roll() {
  if (mode.value === 'normal') {
    const result = diceStore.roll('Учебная проверка Скрытности', 'd20+5', { log: false })
    const value = result.parts.find(part => part.kind === 'dice')?.rolls?.[0] || 1
    lastRoll.value = { rolls: [value], kept: value, dropped: [] }
    return
  }

  const rolls = [randomD20(), randomD20()]
  const keepHigh = mode.value === 'advantage'
  const keptIndex = keepHigh ? (rolls[0] >= rolls[1] ? 0 : 1) : (rolls[0] <= rolls[1] ? 0 : 1)
  const kept = rolls[keptIndex]
  const dropped = [keptIndex === 0 ? 1 : 0]
  const action = keepHigh ? 'Учебная проверка с преимуществом' : 'Учебная проверка с помехой'

  diceStore.pushEntry({
    action,
    log: false,
    result: {
      parts: [{ sign: '+', operator: '+', kind: 'dice', n: 2, sides: 20, rolls, sum: kept, dropped }],
      total: kept + 5,
      byType: [{ label: null, color: null, value: kept + 5 }],
      expression: `2d20${keepHigh ? 'kh' : 'kl'}+5`,
    },
  })
  lastRoll.value = { rolls, kept, dropped }
}
</script>

<style scoped>
.check-visual { margin: 24px 0 28px; padding: 18px; }
.check-controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.check-kicker { color: var(--text-muted); font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
.check-formula { display: grid; grid-template-columns: minmax(130px, 1.4fr) auto 1fr auto 1fr auto 1fr; align-items: center; gap: 12px; margin-top: 24px; }
.check-formula > svg { width: 17px; color: var(--text-muted); }
.check-dice { min-height: 78px; display: flex; align-items: center; }
.check-dice > span { margin-left: 7px; color: var(--text-muted); font-size: 9px; }
.check-die--dropped { opacity: .34; filter: grayscale(1); transform: scale(.88); }
.check-number,
.check-total { display: grid; justify-items: center; gap: 3px; }
.check-number strong { color: var(--text-1); font-size: 25px; }
.check-number span,
.check-total span { color: var(--text-muted); font-size: 9px; text-align: center; }
.check-total { min-width: 66px; padding: 12px; border-radius: 10px; background: color-mix(in srgb, var(--warning) 14%, var(--surface)); }
.check-total strong { color: var(--warning); font-size: 30px; }
.check-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border); }
.check-footer > span { color: var(--text-muted); font-size: 10px; line-height: 1.4; }
.check-footer button { display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border: 0; border-radius: 8px; color: var(--text-on-accent); background: var(--accent); font: inherit; font-size: 11px; font-weight: 800; cursor: pointer; white-space: nowrap; }
.check-footer button:hover { background: var(--accent-hover); }
.check-footer button svg { width: 15px; height: 15px; }
@media (max-width: 720px) {
  .check-controls { align-items: stretch; flex-direction: column; }
  .check-formula { grid-template-columns: 1fr auto 1fr; }
  .check-dice { grid-column: 1 / -1; justify-content: center; }
  .check-formula > svg:nth-of-type(3) { display: none; }
  .check-total { grid-column: 1 / -1; }
}
@media (max-width: 480px) {
  .check-footer { align-items: stretch; flex-direction: column; }
  .check-footer button { justify-content: center; }
}
</style>
