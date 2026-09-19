import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useSpellPicker } from './useSpellPicker'

describe('spell acquisition and preparation', () => {
  it('limits known casters, but permits a growing book and an unprepared collection', () => {
    const rules = ref({ hasKnownProgression: true, spellsKnown: 1, cantripsKnown: 1, allowedSchoolIds: [], selectionMode: 'known' })
    const picker = useSpellPicker({
      activeTabSpells: ref([{ id: 1 }, { id: 2 }]), grants: ref([]), activeTab: ref({ key: 'class' }),
      itemMap: { 1: { data: { lvl: 1 } }, 2: { data: { lvl: 0 } } },
      knownRules: rules, selectedSourceMaxSpellLevel: ref(1),
    })
    const leveled = { id: 3, data: { lvl: 1 } }
    expect(picker.spellPickerEligibility(leveled).eligible).toBe(false)
    for (const mode of ['prepared', 'spellbook']) {
      rules.value.selectionMode = mode
      expect(picker.spellPickerEligibility(leveled).eligible).toBe(true)
      expect(picker.spellPickerEligibility({ id: 4, data: { lvl: 0 } }).eligible).toBe(false)
    }
  })
})
