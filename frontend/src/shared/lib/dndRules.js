import { STAT_KEYS, SUGGEST16_TO_STAT } from './dndStats'
const EXHAUSTION_2014 = ['Помеха на проверки характеристик', 'Скорость уменьшена вдвое', 'Помеха на броски атаки и спасброски', 'Максимум хитов уменьшен вдвое', 'Скорость становится 0', 'Смерть']
const profiles = {
  '2014': Object.freeze({
    version: '2014', hitDiceRecovery: total => Math.max(1, Math.floor(total / 2)),
    exhaustionDescriptions: EXHAUSTION_2014, inspirationName: 'Вдохновение',
    inspirationDescription: 'Преимущество на один бросок атаки, проверки или спасброска',
    backgroundAbilityScores: false, originFeatRequired: false,
    spellcastingRule: 'После заклинания бонусным действием в этот ход можно сотворить только заговор со временем накладывания 1 действие.',
    exhaustionEffects: () => [],
  }),
  '2024': Object.freeze({
    version: '2024', hitDiceRecovery: total => total,
    exhaustionDescriptions: Array.from({ length: 6 }, (_, i) => i === 5 ? 'Смерть' : `−${(i + 1) * 2} к тестам d20; скорость −${(i + 1) * 5} фт.`),
    inspirationName: 'Героическое вдохновение',
    inspirationDescription: 'Перебросьте одну любую кость сразу после броска; используйте новый результат.',
    backgroundAbilityScores: true, originFeatRequired: true,
    spellcastingRule: 'В каждый ход можно потратить на сотворение заклинаний только одну ячейку. Сотворения без ячейки не расходуют этот лимит.',
    exhaustionEffects(level) {
      const n = Math.max(0, Math.min(6, Number(level) || 0))
      if (!n) return []
      const source = { source_label: 'Истощение', source_entry: {}, ownerLevel: 1 }
      return [
        { ...source, key: 'rules:exhaustion:roll', kind: 'roll_bonus', formula: `-${n * 2}`, scopes: ['ability_check', 'skill_check', 'tool', 'saving_throw', 'attack', 'initiative', 'death_save'] },
        { ...source, key: 'rules:exhaustion:speed', kind: 'speed_bonus', value: -n * 5 },
      ]
    },
  }),
}
export function dndRules(version = '2014') {
  const profile = profiles[String(version)]
  if (!profile) throw new Error(`Неизвестная редакция D&D: ${version}`)
  return profile
}
export function originAbilityBonuses(version, allowed, choices) {
  if (!dndRules(version).backgroundAbilityScores) return []
  const entries = Object.entries(choices || {}).filter(([, value]) => Number(value) > 0)
  const amounts = entries.map(([, value]) => Number(value)).sort()
  if (!(amounts.join(',') === '1,2' || amounts.join(',') === '1,1,1')) return null
  if (entries.some(([stat]) => !allowed.includes(stat))) return null
  return entries.map(([stat, value]) => ({ stat, bonus: Number(value) }))
}

export function backgroundAbilities(background) {
  const ids = background?.data?.ability_options
  return Array.isArray(ids) && ids.length ? ids.map(id => SUGGEST16_TO_STAT[id] || id).filter(stat => STAT_KEYS.includes(stat)) : STAT_KEYS
}
