import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {RED_ROLES} from '../../src/features/character-editor/settings/cyberpunk-red/catalogue.js'
import {redInitialSkills,redStatsFromRolls} from '../../src/features/character-editor/settings/cyberpunk-red/creation.js'
import {finishRedCreation,redCyberValidation,redEffectiveStats} from '../../src/features/character-editor/settings/cyberpunk-red/equipment.js'
import {redDamage,redAdvance,redNetActions,redSoloAllocation} from '../../src/features/character-editor/settings/cyberpunk-red/gameplay.js'
import {redUseConsumable,redEndDrug,redBonuses} from '../../src/features/character-editor/settings/cyberpunk-red/effects.js'
import {RED_STARTING_KITS} from '../../src/features/character-editor/settings/cyberpunk-red/startingKits.js'
const items=JSON.parse(fs.readFileSync(new URL('../../../internal/cyberpunkred/core.json',import.meta.url),'utf8')).items
const choices={name:'Test',nativeLanguage:'Русский',specializations:{science:'Биология','play-instrument':'Гитара'}}
function draft(role='solo',method='streetrat'){
 return {...choices,role,method,stats:method==='complete'?{INT:6,REF:8,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:6,EMP:6}:redStatsFromRolls(role,method,method==='streetrat'?[6]:Array(10).fill(6)),statRolls:method==='streetrat'?[6]:Array(10).fill(6),skills:redInitialSkills(role,'streetrat',choices),kitChoices:Object.fromEntries(RED_STARTING_KITS[role].filter(r=>r.choice).map(r=>[r.choice,0])),cart:[]}
}
for(const {key}of RED_ROLES)for(const method of ['streetrat','edgerunner','complete'])test(`finished sheet ${key}/${method} has valid kits and resources`,()=>{
 const {values:v}=finishRedCreation(draft(key,method),items)
 assert.equal(v.creation.complete,true)
 assert.equal(v.inventory.entries.filter(e=>e.key==='weapon-unarmed').length,1)
 assert.ok(v.humanity.current>=0)
 assert.deepEqual(redCyberValidation(v.cyberware.installations,items,v.stats).errors,[])
 for(const e of [...v.inventory.entries,...v.cyberware.installations])assert.ok(items.some(i=>i.key===e.key),e.key)
})
test('damage honors strongest layer, half SP, head multiplication and critical bonus',()=>{
 const v=finishRedCreation(draft(),items).values
 v.inventory.entries=[{uid:'armor',key:'armor-light-armorjack-body',equipped:true,ablation:{body:0,head:0}}]
 const armorItem=items.find(i=>i.kind==='armor'&&i.facts.bodySP===11&&i.facts.headSP===11)
 v.inventory.entries[0].key=armorItem?.key||items.find(i=>i.kind==='armor'&&i.facts.bodySP===11).key
 v.health.current=40
 let hit=redDamage(v,items,{damage:16,armorMode:'half',critical:true})
 assert.equal(hit.protection,6);assert.equal(hit.hpLoss,15);assert.equal(hit.next.inventory.entries[0].ablation.body,1)
 hit=redDamage(v,items,{damage:1,critical:true});assert.equal(hit.hpLoss,5);assert.equal(hit.ablation,0)
 assert.equal(v.health.current,40)
})
test('IP prices, doubled skills and multiclass gate',()=>{
 const v=finishRedCreation(draft(),items).values;v.progression.ipAvailable=1000
 const s=v.skills.find(s=>s.key==='autofire');const next=redAdvance(v,{kind:'skill',uid:s.uid})
 assert.equal(next.progression.ipSpent,(s.rank+1)*40)
 const multiclass=redAdvance(v,{kind:'role',key:'medtech'})
 assert.equal(multiclass.roles.at(-1).rank,1)
 assert.throws(()=>redAdvance(multiclass,{kind:'role',key:'tech'}),/4/)
 assert.throws(()=>redSoloAllocation(4,{precisionAttack:2}))
 assert.deepEqual([1,3,4,6,7,9,10].map(redNetActions),[2,2,3,3,4,4,5])
})
test('drug primary effects and addiction are distinct; doses cannot be spent twice',()=>{
 const v=finishRedCreation(draft(),items).values,boost=items.find(i=>i.key==='drug-boost')
 v.inventory.entries.push({uid:'dose',key:boost.key,count:1,equipped:true})
 assert.equal(redBonuses(v,items)['stat:INT'],undefined)
 const used=redUseConsumable(v,boost,'dose')
 assert.equal(redEffectiveStats(used,items).INT,v.stats.INT+2)
 assert.throws(()=>redUseConsumable(used,boost,'dose'))
 const ended=redEndDrug(used,used.health.conditions[0].uid,false)
 assert.equal(redEffectiveStats(ended,items).INT,v.stats.INT-2)
 assert.equal(v.inventory.entries.find(e=>e.uid==='dose').count,1)
})
test('medical administration requires a medtech and daily limit',()=>{
 const v=finishRedCreation(draft(),items).values,drug=items.find(i=>i.key==='pharma-speedheal')
 v.inventory.entries.push({uid:'dose',key:drug.key,count:2});v.health.current=10
 assert.throws(()=>redUseConsumable(v,drug,'dose'))
 const next=redUseConsumable(v,drug,'dose',{medtech:true})
 assert.equal(next.health.current,10+v.stats.BODY+v.stats.WILL)
 assert.throws(()=>redUseConsumable(next,drug,'dose',{medtech:true}),/период/)
})
test('fashionware combinations and active speedware do not grant unconditional duplicate bonuses',()=>{
 const v=finishRedCreation(draft('solo','complete'),items).values
 v.cyberware.installations=[{uid:'hair',key:'cyberware-techhair'}]
 assert.equal(redBonuses(v,items)['personal-grooming'],undefined)
 v.cyberware.installations.push({uid:'skin',key:'cyberware-chemskin'})
 assert.equal(redBonuses(v,items)['personal-grooming'],2)
 v.cyberware.installations.push({uid:'tattoo1',key:'cyberware-light-tattoo'})
 assert.equal(redBonuses(v,items)['wardrobe-style'],undefined)
 v.cyberware.installations.push({uid:'tattoo2',key:'cyberware-light-tattoo'},{uid:'tattoo3',key:'cyberware-light-tattoo'})
 assert.equal(redBonuses(v,items)['wardrobe-style'],2)
 v.cyberware.installations.push({uid:'speed',key:'cyberware-sandevistan',active:true})
 assert.equal(redBonuses(v,items)['initiative'],3)
})
test('starting cyberweapons expose their installed identity in combat',()=>{
 const v=finishRedCreation(draft('solo'),items).values
 const implant=v.cyberware.installations.find(i=>i.key==='cyberware-wolvers')
 assert.ok(implant)
 assert.equal(v.inventory.entries.find(e=>e.linkedCyberUid===implant.uid)?.key,implant.key)
})
test('injury MOVE has a floor of one before armor can immobilize at zero',()=>{
 const v=finishRedCreation(draft('solo','complete'),items).values
 v.stats.MOVE=2
 v.health.injuries=[{uid:'leg',key:'criticalinjury-broken-leg'}]
 assert.equal(redEffectiveStats(v,items).MOVE,1)
 v.inventory.entries.push({uid:'heavy-armor',key:items.find(i=>i.kind==='armor'&&i.facts.penalty===-2)?.key||items.find(i=>i.kind==='armor'&&Math.abs(i.facts.penalty)===2).key,equipped:true})
 assert.equal(redEffectiveStats(v,items).MOVE,0)
})
