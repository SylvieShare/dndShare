import test from 'node:test'
import assert from 'node:assert/strict'
import { RED_STATS, RED_ROLES, RED_SKILLS_BY_KEY } from '../../src/features/character-editor/settings/cyberpunk-red/catalogue.js'
import { RED_STAT_TABLES, RED_ROLE_SKILLS } from '../../src/features/character-editor/settings/cyberpunk-red/creationTables.js'
import { redStatsFromRolls, redInitialSkills, validateRedCreation, assembleRedBaseDocument } from '../../src/features/character-editor/settings/cyberpunk-red/creation.js'
import { redHealthMaximum, redWoundState, redHumanity } from '../../src/features/character-editor/settings/cyberpunk-red/derived.js'
import { redAccessors } from '../../src/features/character-editor/settings/cyberpunk-red/accessors.js'

const choices = { name: 'Тестовый герой', nativeLanguage: 'Русский', homeArea: 'Уотсон',
  specializations: { science: 'Биология', 'play-instrument': 'Гитара' } }
test('all ten role tables cover all ten die results and ten stats', () => {
  for (const { key } of RED_ROLES) {
    assert.equal(RED_STAT_TABLES[key].length, 10)
    assert.equal(RED_ROLE_SKILLS[key].length, 20)
    for (let die=1;die<=10;die++) {
      const stats=redStatsFromRolls(key,'streetrat',[die])
      assert.equal(Object.keys(stats).length,10)
      assert.ok(Object.values(stats).every(x=>Number.isInteger(x)&&x>=2&&x<=8))
    }
    assert.equal(RED_ROLE_SKILLS[key].reduce((sum,s)=>sum+s.rank*RED_SKILLS_BY_KEY[s.key].costMultiplier,0),86)
  }
})
test('Streetrat rolls one row; Edgerunner rolls each column independently', () => {
  assert.deepEqual(redStatsFromRolls('solo','streetrat',[6]),{
    INT:7,REF:7,DEX:6,TECH:5,COOL:7,WILL:6,LUCK:6,MOVE:7,BODY:7,EMP:5,
  })
  const rolls=[1,2,3,4,5,6,7,8,9,10]
  const values=redStatsFromRolls('solo','edgerunner',rolls)
  assert.deepEqual(RED_STATS.map(s=>values[s.key]),[6,8,7,4,7,6,7,6,6,5])
  assert.throws(()=>redStatsFromRolls('solo','edgerunner',[6]),RangeError)
})
for(const {key:role} of RED_ROLES) for(const method of ['streetrat','edgerunner','complete']) {
  test(`verified allocations assemble ${role}/${method} without D&D fields`,()=>{
    const draft={...choices,role,method,statRolls:method==='streetrat'?[6]:Array(10).fill(6)}
    draft.stats=method==='complete'?Object.fromEntries(RED_STATS.map(({key})=>[key,key==='REF'?8:6])):redStatsFromRolls(role,method,draft.statRolls)
    // Templates provide a valid 86-point allocation also usable in the two flexible modes.
    draft.skills=redInitialSkills(role,'streetrat',choices)
    assert.deepEqual(validateRedCreation(draft).errors,[])
    const document=assembleRedBaseDocument(draft)
    assert.equal(document.values.roles[0].rank,4)
    assert.equal(document.values.health.current,redHealthMaximum(draft.stats.BODY,draft.stats.WILL))
    assert.equal(document.values.skills.find(s=>s.specialization==='Русский').rank,4)
    assert.equal(document.values.creation.complete,false)
    assert.equal(document.values.lvl,undefined)
    assert.equal(document.values.spells,undefined)
    assert.equal(redAccessors.displayName(document),choices.name)
    assert.equal(redAccessors.ac(document),null)
  })
}
test('table tampering, point overspend and missing native language are rejected',()=>{
  const draft={...choices,role:'solo',method:'streetrat',statRolls:[6],stats:redStatsFromRolls('solo','streetrat',[6]),skills:redInitialSkills('solo','streetrat',choices)}
  draft.stats.INT++
  assert.equal(validateRedCreation(draft).valid,false)
  draft.stats.INT--
  draft.skills[0].rank++
  assert.equal(validateRedCreation(draft).valid,false)
  draft.skills[0].rank--
  draft.nativeLanguage=''
  assert.equal(validateRedCreation(draft).valid,false)
})
test('derived health rounds the average up, and wound boundary is strict',()=>{
  assert.equal(redHealthMaximum(6,5),40)
  assert.equal(redHealthMaximum(2,2),20)
  assert.equal(redHealthMaximum(15,10),75)
  assert.equal(redWoundState(20,40).state,'light')
  assert.equal(redWoundState(19,40).state,'serious')
  assert.equal(redWoundState(0,40).state,'mortal')
})
test('Humanity and current EMP remain distinct from original EMP',()=>{
  assert.equal(redHumanity({baseEmpathy:6,current:39,maximumLoss:4}).empathy,3)
  assert.equal(redHumanity({baseEmpathy:6,current:52,maximumLoss:4}).maximum,56)
  assert.equal(redHumanity({baseEmpathy:6,current:-1}).cyberpsychosis,true)
  assert.equal(redHumanity({baseEmpathy:6,current:0}).cyberpsychosis,false)
})
