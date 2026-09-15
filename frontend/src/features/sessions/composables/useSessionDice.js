import { ref } from 'vue'
import { useDiceStore } from '@/stores/dice'

export function useSessionDice() {
  const mode = ref('normal')
  const diceStore = useDiceStore()
  function rollOne(sides) {
    return Math.floor(Math.random() * sides) + 1
  }

  function rollDie(sides) {
    if (mode.value === 'normal') {
      diceStore.roll(`d${sides}`, `d${sides}`, { crit_mode: sides === 20 })
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
      action: title,
      outcome: d20Outcome(sides, winner),
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

  function d20Outcome(sides, value) {
    if (sides !== 20) return null
    if (value === 20) return { kind: 'crit', sides, value }
    if (value === 1) return { kind: 'fumble', sides, value }
    return null
  }

  return { mode, rollDie }
}
