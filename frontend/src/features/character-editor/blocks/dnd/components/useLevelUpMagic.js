import { computed } from 'vue'
import { spellcastingRulesAt } from '@/features/character-editor/blocks/dnd/lib/spellcastingRules'
import { computeSpellSlotPools, maximumSpellLevelForEntry } from '@/features/character-editor/blocks/dnd/lib/multiclassSpellcasting'
import { findClassSpellTab, spellTabFromClass } from '@/features/character-editor/blocks/dnd/lib/spellbook'
import { spellSlotAdditions } from '../lib/spellSlotAdditions'

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
  const slotsBefore = computed(() => (isPlain.value ? null : computeSpellSlotPools(entries.value, slotsCatalog.value)))
  const slotChanges = computed(() => spellSlotAdditions(slotsBefore.value, slotsAfter.value))
  return { entriesAfter, levelUpSpellContext, slotChanges }
}
