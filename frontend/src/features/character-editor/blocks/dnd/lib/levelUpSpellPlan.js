const isCantrip = entry => entry.level === 0
const countKind = (entries, cantrip) => entries.filter(entry => isCantrip(entry) === cantrip).length

/** A level-up draft keeps existing spells intact until a replacement is picked. */
export function levelUpSpellBudget(context, original, additions = [], counted = []) {
  const rules = context.rules || {}
  const known = [...original, ...counted]
  const mode = rules.selectionMode || 'known'
  const cantripLimit = rules.hasKnownProgression || context.isFirstCastingLevel ? rules.cantripsKnown : null
  const spellLimit = (rules.hasKnownProgression || context.isFirstCastingLevel) && mode !== 'spellbook' ? rules.spellsKnown : null
  const cantrips = cantripLimit == null ? null : Math.max(0, cantripLimit - countKind(known, true))
  const spells = mode === 'spellbook' && context.isFirstCastingLevel && rules.spellsKnown != null
    ? Math.max(0, rules.spellsKnown - countKind(known, false))
    : mode === 'spellbook' && rules.levelUpChoices
    ? rules.levelUpChoices
    : spellLimit == null ? null : Math.max(0, spellLimit - countKind(known, false))
  return {
    mode, cantrips, spells, cantripLimit, spellLimit,
    cantripsTotal: countKind(known, true) + countKind(additions, true),
    spellsTotal: countKind(known, false) + countKind(additions, false),
    cantripsAdded: countKind(additions, true), spellsAdded: countKind(additions, false),
    cantripsRemaining: cantrips == null ? null : Math.max(0, cantrips - countKind(additions, true)),
    spellsRemaining: spells == null ? null : Math.max(0, spells - countKind(additions, false)),
    replacements: mode === 'known' && !context.isFirstCastingLevel ? 1 : mode === 'prepared' ? Infinity : 0,
  }
}

export function levelUpSpellEligibility({ item, context, original, additions, selected, counted = [], replacing = null, replacementCount = 0, alreadyReplaced = false, excludedIds = [] }) {
  const rules = context.rules || {}
  const budget = levelUpSpellBudget(context, original, additions, counted)
  const level = Number(item?.data?.lvl)
  const reasons = []
  if (!Number.isInteger(level) || level < 0 || level > Number(context.maxSpellLevel)) reasons.push('Круг пока недоступен этому классу')
  if (rules.listClassId != null && !(item?.data?.classes || []).some(entry => String(entry?.id ?? entry) === String(rules.listClassId))) reasons.push('Не входит в список этого класса')
  if ([...selected, ...counted].some(entry => String(entry.id) === String(item?.id)) || excludedIds.some(id => String(id) === String(item?.id))) reasons.push('Уже известно или выбрано')
  if (replacing) {
    if (level === 0 || replacing.level === 0) reasons.push('Эта замена доступна только для заклинаний 1 круга и выше')
    if (!budget.replacements || (!alreadyReplaced && replacementCount >= budget.replacements)) reasons.push('Доступные замены уже использованы')
  } else {
    if (level === 0 && budget.cantripsRemaining === 0) reasons.push('Все новые заговоры уже выбраны')
    if (level > 0 && budget.spellsRemaining === 0) reasons.push('Все новые заклинания уже выбраны')
  }
  const allowed = new Set((rules.allowedSchoolIds || []).map(String))
  if (level > 0 && allowed.size && !allowed.has(String(item?.data?.schoolId))) {
    const others = [...selected, ...counted].filter(entry => entry !== replacing && entry.level > 0)
    if (others.filter(entry => !allowed.has(String(entry.item?.data?.schoolId))).length >= rules.unrestrictedSpells) reasons.push('Все заклинания вне основных школ уже выбраны')
  }
  return { eligible: !reasons.length, reasons }
}
