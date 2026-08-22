const AUTOMATIC_MODES = new Set(['advantage', 'disadvantage'])
const MANUAL_MODES = new Set(['normal', ...AUTOMATIC_MODES])

export function resolveRollMode(manualMode = 'auto', effects = []) {
  if (MANUAL_MODES.has(manualMode)) {
    return { mode: manualMode, source: 'Переопределено вручную', automatic: false, cancelled: false }
  }

  const active = (Array.isArray(effects) ? effects : []).filter(effect => (
    effect?.active !== false && AUTOMATIC_MODES.has(effect?.mode)
  ))
  const advantages = active.filter(effect => effect.mode === 'advantage')
  const disadvantages = active.filter(effect => effect.mode === 'disadvantage')
  const cancelled = advantages.length > 0 && disadvantages.length > 0
  const mode = cancelled
    ? 'normal'
    : advantages.length ? 'advantage' : disadvantages.length ? 'disadvantage' : 'normal'
  const sourceLabels = [...new Set(active.map(effect => String(effect.source || '')).filter(Boolean))]
  const source = cancelled
    ? ['Преимущество и помеха взаимно отменяются', ...sourceLabels].join(' · ')
    : sourceLabels.join(' · ')
  return { mode, source, automatic: true, cancelled, effects: active }
}

export function armorAbilityRollEffects(armorState, abilitySuggestId) {
  if (!['1', '2'].includes(String(abilitySuggestId)) || !armorState?.strengthDexDisadvantage) return []
  const names = (armorState.nonproficient || []).map(row => row.name).filter(Boolean).join(', ')
  return [{
    mode: 'disadvantage',
    source: names ? `Нет владения: ${names}` : 'Нет владения экипированным доспехом',
  }]
}
