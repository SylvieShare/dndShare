import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { levelUpSpellBudget, levelUpSpellEligibility } from './levelUpSpellPlan'
import { spellcastingRulesAt } from './spellcastingRules'

const sql = readFileSync(new URL('../../../../../../../internal/store/schema/104_bard_spell_progression.sql', import.meta.url), 'utf8')
const progression = JSON.parse(sql.match(/'known_progression', '(\[[\s\S]*?\])'/)[1])
const bard = { data: { spellcasting: { ability: 6, known_progression: progression } } }
const refs = (cantrips, spells) => [...Array.from({ length: cantrips }, () => ({ level: 0 })), ...Array.from({ length: spells }, () => ({ level: 1 }))]

describe('level-up spell budgets', () => {
  it.each([[2, 2, 4, 0, 1], [4, 2, 6, 1, 1], [10, 3, 12, 1, 2], [12, 4, 15, 0, 0], [20, 4, 22, 0, 0]])('reads bard level %i limits from the shipped catalogue', (level, cantrips, spells, newCantrips, newSpells) => {
    const rules = spellcastingRulesAt(bard, level)
    expect(levelUpSpellBudget({ rules }, refs(cantrips, spells))).toMatchObject({ cantrips: newCantrips, spells: newSpells, replacements: 1 })
  })
  it('allows filling an incomplete list and does not require deleting pre-existing excess spells', () => {
    const context = { rules: spellcastingRulesAt(bard, 2) }
    expect(levelUpSpellBudget(context, refs(2, 3)).spells).toBe(2)
    expect(levelUpSpellBudget(context, refs(2, 6)).spells).toBe(0)
  })
  it('counts granted spells that consume the known limit', () => {
    expect(levelUpSpellBudget({ rules: spellcastingRulesAt(bard, 2) }, refs(1, 4), [], refs(1, 1))).toMatchObject({ cantrips: 0, spells: 0 })
  })
  it('does not impose a level-one static limit at later levels when no progression is declared', () => {
    expect(levelUpSpellBudget({ rules: { spellsKnown: 4, cantripsKnown: 2 } }, [])).toMatchObject({ spells: null, cantrips: null })
  })
  it('uses initial wizard book size when the class is first acquired', () => {
    expect(levelUpSpellBudget({ isFirstCastingLevel: true, rules: { selectionMode: 'spellbook', spellsKnown: 6, levelUpChoices: 2 } }, [])).toMatchObject({ spells: 6, replacements: 0 })
  })
  it('checks school exceptions against the list after the replaced spell is removed', () => {
    const replacing = { level: 1, id: 1, item: { data: { schoolId: 9 } } }
    const context = { maxSpellLevel: 2, rules: { allowedSchoolIds: [1], unrestrictedSpells: 1 } }
    const params = { context, original: [replacing], additions: [], selected: [replacing], item: { id: 2, data: { lvl: 2, schoolId: 9 } } }
    expect(levelUpSpellEligibility(params).eligible).toBe(false)
    expect(levelUpSpellEligibility({ ...params, replacing }).eligible).toBe(true)
  })
})
