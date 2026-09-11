import { computed } from 'vue'
import { spellcastingRulesAt } from '@/features/character-editor/blocks/dnd/lib/spellcastingRules'
import { computeSpellSlotPools, maximumSpellLevelForEntry } from '@/features/character-editor/blocks/dnd/lib/multiclassSpellcasting'
import { findClassSpellTab, spellTabFromClass } from '@/features/character-editor/blocks/dnd/lib/spellbook'
import { progressionSlotChanges } from '@/features/items/lib/progressionSlotChanges'

export function useLevelUpMagic({ props, entries, target, classItem, subclassPick, isNew, isPlain, itemsById, newClassLevel, effectiveSubclassItem, effectiveSubclass }) {
  const entriesAfter = computed(() => {
    const next = entries.value.map((e) => ({ ...e, subclass: e.subclass ? { ...e.subclass } : null }))
    if (target.value?.kind === 'class') {
      const e = next[target.value.index]
      e.level += 1
      if (subclassPick.value) e.subclass = { id: subclassPick.value.id, name: subclassPick.value.name }
    } else if (target.value?.kind === 'new') {
      next.push({
        id: classItem.value.id,
        name: classItem.value.name,
        level: 1,
        subclass: subclassPick.value ? { id: subclassPick.value.id, name: subclassPick.value.name } : null,
      })
    }
    return next
  })
  const slotsCatalog = computed(() => {
    const map = { ...itemsById.value }
    if (isNew.value && classItem.value) map[classItem.value.id] = classItem.value
    if (subclassPick.value) map[subclassPick.value.id] = subclassPick.value
    return map
  })
  const slotsAfter = computed(() => (isPlain.value ? null : computeSpellSlotPools(entriesAfter.value, slotsCatalog.value)))
  const levelUpSpellContext = computed(() => {
    if (isPlain.value || !classItem.value) return null
    const resolvedRules = spellcastingRulesAt(effectiveSubclassItem.value, newClassLevel.value)
      || spellcastingRulesAt(classItem.value, newClassLevel.value)
    if (!resolvedRules) return null
    const rules = { ...resolvedRules, listClassId: resolvedRules.listClassId ?? classItem.value.id }
    const subclassId = effectiveSubclass.value?.id ?? ''
    const entry = {
      id: classItem.value.id,
      level: newClassLevel.value,
      subclass: subclassId === '' ? null : { id: subclassId },
    }
    const existingTab = findClassSpellTab(props.values?.spells?.tabs, classItem.value.id)
    const tab = existingTab || spellTabFromClass(classItem.value, rules)
    return {
      rules,
      isFirstCastingLevel: isNew.value || newClassLevel.value === rules.startLevel,
      tab,
      label: tab.name,
      countedGrants: (props.values?.spells?.grants || []).filter(grant => grant.counts_as_known && grant.tab_key === tab.key),
      excludedSpellIds: (props.values?.spells?.grants || []).filter(grant => grant.tab_key === tab.key).map(grant => grant.id),
      maxSpellLevel: maximumSpellLevelForEntry(entry, slotsCatalog.value),
    }
  })
  const slotDiff = computed(() => {
    if (!slotsAfter.value?.isCaster) return []
    const out = []
    const required = {
      long_rest: slotsAfter.value.totals,
      short_rest: Array.from({ length: 9 }, (_, index) => slotsAfter.value.pact?.slotLevel === index + 1 ? slotsAfter.value.pact.count : 0),
    }
    for (const rest of ['long_rest', 'short_rest']) {
      const current = new Map((props.values?.spells?.slot_pools?.[rest] || []).map((slot) => [Number(slot.level), Number(slot.total) || 0]))
      required[rest].forEach((to, index) => {
        const from = current.get(index + 1) || 0
        if (to !== from) out.push({ rest, level: index + 1, from, to })
      })
    }
    return out
  })

  const slotChanges = computed(() => {
    if (!slotsAfter.value) return []
    const pools = props.values?.spells?.slot_pools || {}
    const short = (pools.short_rest || []).find(slot => Number(slot.total) > 0)
    return progressionSlotChanges(slotsAfter.value, {
      totals: Array.from({ length: 9 }, (_, i) => Number((pools.long_rest || []).find(slot => Number(slot.level) === i + 1)?.total) || 0),
      pact: short ? { count: Number(short.total), slotLevel: Number(short.level) } : null,
    })
  })
  return { entriesAfter, slotsAfter, levelUpSpellContext, slotDiff, slotChanges }
}
