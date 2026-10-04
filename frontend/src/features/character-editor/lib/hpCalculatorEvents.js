import { hpMaximum } from '../blocks/dnd/lib/hp'

function snapshot(hp) {
  return { current: Math.max(0, parseInt(hp.current) || 0), temp: Math.max(0, parseInt(hp.temp) || 0), max: hpMaximum(hp) }
}

export function hpCalculatorEvent(previous, next, operation) {
  if (!['damage', 'heal'].includes(operation?.kind)) return null
  const before = snapshot(previous), after = snapshot(next)
  const absorbed = Math.max(0, before.temp - after.temp)
  const applied = operation.kind === 'damage' ? before.current - after.current + absorbed : after.current - before.current
  if (applied <= 0) return null
  return {
    type: 'hp_changed',
    action: `${operation.kind === 'damage' ? 'Получен урон' : 'Восстановлено хитов'}: ${applied}`,
    data: { kind: operation.kind, amount: operation.amount, applied, absorbed, before, after },
  }
}
