import test from 'node:test'
import assert from 'node:assert/strict'
import { RED_STATS, RED_SKILLS, RED_SKILLS_BY_KEY, RED_ROLES } from '../../src/features/character-editor/settings/cyberpunk-red/catalogue.js'
import { resolveRedSkillCheck, resolveRedOpposedCheck, resolveRedInitiative, previewRedBodyHit } from '../../src/features/character-editor/settings/cyberpunk-red/checks.js'
import { validateRedStatAllocation, validateRedSkillAllocation } from '../../src/features/character-editor/settings/cyberpunk-red/creationValidation.js'

const check = changes => resolveRedSkillCheck({ stat: 6, skill: 4, die: 5, availableLuck: 3, ...changes })
test('check must exceed DV; a natural 1/10 is not an automatic outcome', () => {
  assert.equal(check({ dv: 15 }).success, false)
  assert.equal(check({ dv: 14 }).success, true)
  assert.equal(check({ die: 1, extraDie: 2, dv: 8 }).success, true)
  assert.equal(check({ die: 10, extraDie: 1, dv: 25 }).success, false)
})
test('critical dice apply exactly once, including a second 1 or 10', () => {
  assert.equal(check({ die: 1, extraDie: 10 }).total, 1)
  assert.equal(check({ die: 10, extraDie: 10 }).total, 30)
  assert.deepEqual(check({ die: 10, extraDie: 10 }).dice, [10, 10])
  assert.throws(() => check({ die: 1 }), RangeError)
  assert.throws(() => check({ extraDie: 5 }), RangeError)
})
test('luck, modifiers and limits are explicit; no resource is mutated', () => {
  const input={stat:6,skill:4,die:5,modifiers:-2,luck:3,availableLuck:3}
  const before=structuredClone(input)
  assert.equal(resolveRedSkillCheck(input).total,16)
  assert.deepEqual(input,before)
  assert.throws(()=>check({luck:4}),/Insufficient/)
  for(const die of [0,11,NaN,'5',1.5]) assert.throws(()=>check({die}),RangeError)
  assert.throws(()=>check({skill:11}),RangeError)
})
test('opposed ties favor the defender and initiative never explodes', () => {
  assert.equal(resolveRedOpposedCheck(20,20).winner,'defender')
  assert.equal(resolveRedOpposedCheck(21,20).winner,'attacker')
  assert.equal(resolveRedInitiative({reflexes:8,die:10}).total,18)
})
test('normal armor: blocked/equal damage does not ablate; penetration does', () => {
  assert.equal(previewRedBodyHit({damageDice:[5,5],sp:11}).hpLoss,0)
  assert.equal(previewRedBodyHit({damageDice:[5,6],sp:11}).spLoss,0)
  assert.deepEqual(previewRedBodyHit({damageDice:[5,5,5],sp:11}),{
    rawDamage:15,effectiveSp:11,penetratingDamage:4,criticalInjury:false,
    criticalBonus:0,hpLoss:4,spLoss:1,spAfter:10,
  })
})
test('half armor rounds upward, then ablative loss uses the actual armor', () => {
  const hit=previewRedBodyHit({damageDice:[3,4],sp:11,armorMode:'half'})
  assert.equal(hit.effectiveSp,6)
  assert.equal(hit.hpLoss,1)
  assert.equal(hit.spAfter,10)
})
test('critical bonus penetrates protection without alone causing ablation', () => {
  const hit=previewRedBodyHit({damageDice:[6,6],sp:18})
  assert.equal(hit.hpLoss,5)
  assert.equal(hit.criticalInjury,true)
  assert.equal(hit.spAfter,18)
  assert.equal(previewRedBodyHit({damageDice:[6,6],sp:18,criticalEligible:false}).hpLoss,0)
})
test('zero SP stays zero and malformed damage cannot enter a preview', () => {
  assert.equal(previewRedBodyHit({damageDice:[6],sp:0}).spAfter,0)
  assert.equal(previewRedBodyHit({damageDice:[6],sp:0}).criticalInjury,false)
  assert.throws(()=>previewRedBodyHit({damageDice:[],sp:5}),RangeError)
  assert.throws(()=>previewRedBodyHit({damageDice:[7],sp:5}),RangeError)
  assert.throws(()=>previewRedBodyHit({damageDice:[3],sp:5,armorMode:'none'}),RangeError)
})
test('catalogue separates specialized skills and corrected control skill stats', () => {
  assert.equal(RED_STATS.length,10)
  assert.equal(RED_ROLES.length,10)
  assert.equal(RED_SKILLS.length,66)
  assert.equal(new Set(RED_SKILLS.map(s=>s.key)).size,66)
  assert.ok(RED_SKILLS.filter(s=>s.groupKey==='control').every(s=>s.statKey==='REF'))
  assert.equal(RED_SKILLS.filter(s=>s.costMultiplier===2).length,7)
  assert.equal(RED_SKILLS_BY_KEY['play-instrument'].specializationKind,'instrument')
  assert.equal(RED_SKILLS_BY_KEY['martial-arts'].specializationKind,'martial-art')
})
test('allocation requires an explicit profile, rejects strings and unknown stats', () => {
  const stats=Object.fromEntries(RED_STATS.map(s=>[s.key,5]))
  const profile={statBudget:50,statMin:2,statMax:8}
  assert.equal(validateRedStatAllocation(stats,profile).valid,true)
  assert.equal(validateRedStatAllocation({...stats,INT:'5'},profile).valid,false)
  assert.equal(validateRedStatAllocation({...stats,STR:5},profile).valid,false)
  assert.throws(()=>validateRedStatAllocation(stats),TypeError)
})
test('skill budget charges double cost, grants only their specific specialization', () => {
  const entries=[{uid:'1',key:'language',specialization:'Русский',rank:4},
    {uid:'2',key:'language',specialization:'Японский',rank:2},
    {uid:'3',key:'autofire',rank:3}]
  const profile={skillBudget:8,skillMax:6,grants:[{key:'language',specialization:'Русский',rank:4}]}
  const result=validateRedSkillAllocation(entries,profile)
  assert.equal(result.spent,8)
  assert.equal(result.valid,true)
  assert.equal(validateRedSkillAllocation(entries.slice(1),profile).valid,false)
})
test('minimums, duplicate identities, and cross-role restrictions cannot be bypassed', () => {
  const profile={skillBudget:4,skillMax:6,minimums:[{key:'first-aid',rank:2}]}
  const entries=[{uid:'1',key:'first-aid',rank:2},{uid:'2',key:'handgun',rank:2}]
  assert.equal(validateRedSkillAllocation(entries,profile).valid,true)
  assert.equal(validateRedSkillAllocation(entries,{...profile,allowedSkills:['first-aid']}).valid,false)
  assert.equal(validateRedSkillAllocation([{uid:'1',key:'handgun',rank:4}],profile).valid,false)
  assert.equal(validateRedSkillAllocation([entries[0],{...entries[0],uid:'2'}],profile).valid,false)
  assert.equal(validateRedSkillAllocation([{uid:'x',key:'language',rank:4}],profile).valid,false)
  assert.equal(validateRedSkillAllocation([{uid:'x',key:'handgun',specialization:'Pistol',rank:4}],profile).valid,false)
})
