import { describe, expect, it } from 'vitest'
import { initiativeSummary, proficiencySummary, speedSummary } from './utilityValues'

describe('utility totals shared by character menus and editors', () => {
  it('combines movement bonuses, armor penalty and multiplier in the canonical order', () => {
    const context={characterArmor:{state:{speedPenalty:10}},characterDerivedEffects:{speed:()=>({total:5,multiplier:2,sources:[]})}}
    expect(speedSummary({base:30,bonuses:[{value:5}]},context).total).toBe(60)
  })
  it('uses live Dexterity and derived initiative bonuses without inventing an unset path', () => {
    const context={characterDerivedEffects:{bonus:()=>({total:4})}}
    const value={base:1,use_dex:true,bonuses:[{value:2}]},values={DEX:{value:{base:16,bonuses:[]}}}
    expect(initiativeSummary(value,values,context).total).toBe(10)
    expect(initiativeSummary(value,values,context,null).total).toBe(7)
  })
  it('keeps manual mastery independent of level while retaining additional bonuses', () => {
    expect(proficiencySummary({auto:true,v:2,bonuses:[{value:1}]},9).total).toBe(5)
    expect(proficiencySummary({auto:false,v:7,bonuses:[{value:-1}]},20).total).toBe(6)
  })
})
