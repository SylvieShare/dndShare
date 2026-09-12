import { computed } from 'vue'

export function useSpellPicker({ activeTabSpells, grants, activeTab, itemMap, knownRules, selectedSourceMaxSpellLevel }) {
  const knownEntries = computed(() => [
    ...activeTabSpells.value,
    ...grants.value.filter((entry) => entry.counts_as_known && entry.tab_key === activeTab.value?.key),
  ]
    .map((ref) => ({ ref, item: itemMap[ref.id] }))
    .filter((entry) => entry.item))
  const knownCounts = computed(() => {
    const rules = knownRules.value
    const leveled = knownEntries.value.filter((entry) => Number(entry.item.data?.lvl) > 0)
    const allowed = new Set((rules?.allowedSchoolIds || []).map(String))
    return {
      cantrips: knownEntries.value.filter((entry) => Number(entry.item.data?.lvl) === 0).length,
      spells: leveled.length,
      unrestricted: allowed.size
        ? leveled.filter((entry) => !allowed.has(String(entry.item.data?.schoolId))).length
        : 0,
    }
  })
  const spellPickerFilters = computed(() => {
    const rules = knownRules.value
    if (!rules) return {}
    const levels = Array.from({ length: Math.max(0, selectedSourceMaxSpellLevel.value) + 1 }, (_, index) => index)
    return {
      ...(rules.listClassId != null ? { 'classes.id': [rules.listClassId] } : {}),
      lvl: levels,
    }
  })

  function spellPickerEligibility(item) {
    const rules = knownRules.value
    if (!rules) return { eligible: true, reasons: [] }
    const level = Number(item?.data?.lvl)
    const reasons = []
    if (rules.hasKnownProgression && rules.cantripsKnown != null && level === 0 && knownCounts.value.cantrips >= rules.cantripsKnown) reasons.push('Лимит известных заговоров уже заполнен')
    if (rules.hasKnownProgression && rules.spellsKnown != null && level > 0 && knownCounts.value.spells >= rules.spellsKnown) reasons.push('Лимит известных заклинаний уже заполнен')
    if (level > 0 && rules.allowedSchoolIds.length
      && !rules.allowedSchoolIds.some((id) => String(id) === String(item?.data?.schoolId))
      && knownCounts.value.unrestricted >= rules.unrestrictedSpells) {
      reasons.push('Все доступные заклинания вне основных школ уже выбраны')
    }
    return { eligible: reasons.length === 0, reasons }
  }

  return { knownCounts, spellPickerFilters, spellPickerEligibility }
}
