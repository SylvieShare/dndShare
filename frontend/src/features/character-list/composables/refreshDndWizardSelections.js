import { originChildren } from '@/shared/lib/dndItemTypes'

export function refreshDndWizardSelections(state, { races, subraces, classes, subclasses, backgrounds }) {
  const removed = []
  function refresh(key, candidates, label) {
    const selected = state[key]
    if (!selected) return
    state[key] = candidates.find(item => String(item.id) === String(selected.id)) || null
    if (!state[key]) removed.push(`${label} «${selected.name || selected.id}»`)
  }
  refresh('race', races, 'Раса')
  refresh('subrace', state.race ? originChildren(state.race, subraces, 'subraces') : [], 'Происхождение')
  refresh('charClass', classes, 'Класс')
  refresh('subclass', state.charClass ? originChildren(state.charClass, subclasses, 'subclasses') : [], 'Архетип')
  refresh('background', backgrounds, 'Предыстория')
  if (!state.race?.data?.variants?.some(option => option.value === state.raceVariant)) state.raceVariant = null
  return removed.length ? `${removed.join(', ')} больше недоступны в выбранных источниках. Сделайте выбор заново.` : ''
}
