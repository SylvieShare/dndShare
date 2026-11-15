import { computed, effectScope, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { applyDocumentPatches, copyDocument, documentDiff } from '@/shared/lib/documentPatch'
import { useEncounterReserves } from '../composables/useEncounterReserves'
import { useEncounterFlow } from '../composables/useEncounterFlow'
import { createEncounterReserve, encounterReserveTabs, removeEncounterReserve, renameEncounterReserve } from './encounterReserves'

const creature=(uid,position='reserve',reserveTabId)=>({uid,type:'npc',position,hpCurrent:14,hpTemp:2,initiative:18,tieBreak:0,markerLetter:uid,override:{name:uid,hp:20},...(reserveTabId?{reserveTabId}:{})})
const document=()=>({active:true,round:3,turnIndex:1,combatants:[creature('a'),creature('b')]})
function setup(data=document(),ready=true){
  const encounter=ref(structuredClone(data)),loaded=ref(ready),scope=effectScope()
  const getCombatant=uid=>encounter.value.combatants.find(c=>c.uid===uid)
  const mutate=fn=>{fn();encounter.value={...encounter.value,combatants:[...encounter.value.combatants]}}
  const reserves=scope.run(()=>useEncounterReserves({encounter,loaded,getCombatant,mutate}))
  return{encounter,loaded,scope,getCombatant,mutate,reserves}
}

describe('encounter reserve tabs',()=>{
  it('provides an immutable permanent default without writing metadata on hydration',()=>{
    const data=document(),before=structuredClone(data)
    expect(encounterReserveTabs(data)).toEqual([{id:'default',name:'Запас',permanent:true}])
    expect(renameEncounterReserve(data,'default','Other')).toBe(data)
    expect(removeEncounterReserve(data,'default')).toBe(data)
    expect(data).toEqual(before)
    expect(data).not.toHaveProperty('reserveTabs')
  })
  it('creates and renames custom tabs by stable ids without mutating the source',()=>{
    const data=document(),first=createEncounterReserve(data,'wolves',' Волки '),next=renameEncounterReserve(first,'wolves','Стая')
    expect(next.reserveTabs).toEqual([{id:'wolves',name:'Стая'}])
    expect(data).not.toHaveProperty('reserveTabs')
    expect(createEncounterReserve(next,'wolves','Duplicate')).toBe(next)
    expect(createEncounterReserve(next,'default','Wrong')).toBe(next)
    expect(renameEncounterReserve(next,'wolves','  ')).toBe(next)
  })
  it('changes only NPC membership and filters the active reserve',()=>{
    const {reserves,encounter,getCombatant,scope}=setup()
    const id=reserves.createReserve('Стая'),before=copyDocument(getCombatant('a'))
    reserves.moveNpcToReserve(getCombatant('a'),id)
    expect(reserves.reserveNpcs.value.map(c=>c.uid)).toEqual(['a'])
    expect(getCombatant('a')).toEqual({...before,reserveTabId:id})
    reserves.selectReserve('default')
    expect(reserves.reserveNpcs.value.map(c=>c.uid)).toEqual(['b'])
    expect(encounter.value).toMatchObject({active:true,round:3,turnIndex:1})
    scope.stop()
  })
  it('removes a tab without deleting or changing reserve, combat or dead creatures',()=>{
    const data={...document(),reserveTabs:[{id:'a',name:'A'},{id:'b',name:'B'}],combatants:[creature('one','reserve','a'),creature('two','combat','a'),creature('three','dead','a'),creature('four','reserve','b')]}
    const next=removeEncounterReserve(data,'a')
    expect(next.reserveTabs).toEqual([{id:'b',name:'B'}])
    expect(next.combatants.map(c=>c.uid)).toEqual(data.combatants.map(c=>c.uid))
    for(let i=0;i<3;i++){
      const expected={...data.combatants[i]};delete expected.reserveTabId
      expect(next.combatants[i]).toEqual(expected)
    }
    expect(next.combatants[3]).toBe(data.combatants[3])
    expect(next).toMatchObject({active:true,round:3,turnIndex:1})
  })
  it('keeps orphaned home references visible in default and disables writes before a successful GET',()=>{
    const data={...document(),combatants:[creature('a','reserve','removed')]}
    const {reserves,encounter,scope}=setup(data,false)
    expect(reserves.reserveNpcs.value.map(c=>c.uid)).toEqual(['a'])
    expect(reserves.createReserve()).toBeNull()
    reserves.moveNpcToReserve(encounter.value.combatants[0],'default')
    expect(encounter.value).toEqual(data)
    scope.stop()
  })
  it('retains concurrent HP edits when renaming a tab with stable document selectors',()=>{
    const data={...document(),reserveTabs:[{id:'wolves',name:'Волки'}]}
    const rename=renameEncounterReserve(data,'wolves','Стая'),damage=structuredClone(data)
    damage.combatants[0].hpCurrent=9
    const patches=documentDiff(data,rename)
    expect(patches).toEqual([{op:'set',path:['reserveTabs',{idField:'id',id:'wolves'},'name'],value:'Стая'}])
    const merged=applyDocumentPatches(damage,patches)
    expect(merged.reserveTabs[0].name).toBe('Стая')
    expect(merged.combatants[0].hpCurrent).toBe(9)
  })
  it('assigns a drop to the visible reserve and retains that home through combat',async()=>{
    const data={...document(),reserveTabs:[{id:'wolves',name:'Волки'}],combatants:[creature('a'),creature('b','reserve','wolves')]}
    const {reserves,encounter,getCombatant,mutate,scope}=setup(data)
    reserves.selectReserve('wolves')
    const inCombat=computed(()=>encounter.value.combatants.filter(c=>c.position==='combat'))
    const flow=useEncounterFlow({encounter,getCombatant,mutate,inCombat,turnOrder:inCombat,selectedUids:ref(new Set()),unselect(){},rollInitiativeFor:()=>18,
      reserveTabMatches:c=>reserves.reserveIdFor(c)===reserves.activeReserveId.value,onReserveDrop:reserves.stampActiveReserve})
    flow.performSortDrop({item:getCombatant('a'),toGroup:'reserve-npc',toIndex:1})
    expect(reserves.reserveNpcs.value.map(c=>c.uid)).toEqual(['b','a'])
    flow.performSortDrop({item:getCombatant('a'),toGroup:'combat',toIndex:0})
    expect(getCombatant('a')).toMatchObject({position:'combat',reserveTabId:'wolves',hpCurrent:14})
    await flow.sendToReserve(getCombatant('a'))
    expect(getCombatant('a')).toMatchObject({position:'reserve',reserveTabId:'wolves'})
    reserves.removeReserve('wolves');await nextTick()
    expect(reserves.activeReserveId.value).toBe('default')
    scope.stop()
  })
})
