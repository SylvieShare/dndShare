import { describe, expect, it } from 'vitest'
import { levelExperience, levelUpDraftValues } from './experience'
import { buildLevelUpUpdates } from '../components/buildLevelUpUpdates'

describe('level-up experience', () => {
  it.each([
    [1, 0, 300, 300], [2, 500, 900, 400], [4, 4000, 6500, 2500],
    [19, 305000, 355000, 50000], [20, 355000, null, 0],
  ])('calculates the next threshold for level %i', (level, exp, threshold, missing) => {
    expect(levelExperience({ level, exp })).toMatchObject({ nextLevelExp: threshold, missingExp: missing })
  })

  it('keeps the XP top-up in a draft and applies it together with the new level', () => {
    const values = { lvl: { level: 2, exp: 400 }, classes: [{ id: 1, level: 2 }] }
    const draft = levelUpDraftValues(values, values.lvl, 900)
    expect(values.lvl).toEqual({ level: 2, exp: 400 })
    const updates = buildLevelUpUpdates({ values: draft, newTotal: 3, isPlain: true })
    expect(updates.lvl).toEqual({ level: 3, exp: 900 })
    expect(values.lvl).toEqual({ level: 2, exp: 400 })
  })

  it('does not lower existing XP or carry a cancelled top-up into the next normal opening', () => {
    const values = { lvl: { level: 2, exp: 1200 } }
    expect(levelUpDraftValues(values, values.lvl, 900).lvl.exp).toBe(1200)
    const data = { level: 1, exp: 20 }
    expect(levelUpDraftValues({}, data, 300).lvl.exp).toBe(300)
    expect(levelUpDraftValues({}, data, null).lvl.exp).toBe(20)
  })

  it('uses the current level block when the sheet supplies a custom block ID', () => {
    const values = { customLevel: { level: 3, exp: 1000 } }
    expect(levelUpDraftValues(values, values.customLevel, 2700).lvl).toEqual({ level: 3, exp: 2700 })
    expect(values.customLevel.exp).toBe(1000)
  })
})
