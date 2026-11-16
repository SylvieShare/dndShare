import { computed, watch } from 'vue'
import { pvExperiencePath, pvHpPath } from '../lib/participantView'

export function useRosterSelection(encounter, getItems) {
  const items=computed(()=>[...new Map(getItems().filter(row=>row?.uid && row.position!=='dead').map(row=>[row.uid,row])).values()])
  const selected=computed(()=>items.value.filter(row=>encounter.isSelected(row)))
  const damageTargets=computed(()=>selected.value.filter(row=>row.type==='npc'||pvHpPath(encounter.findParticipant(row.charId))))
  const experienceTargets=computed(()=>selected.value.filter(row=>row.type==='player'&&pvExperiencePath(encounter.findParticipant(row.charId))))
  const supportsExperience=computed(()=>items.value.some(row=>row.type==='player'&&pvExperiencePath(encounter.findParticipant(row.charId))))
  const moveTargets=computed(()=>selected.value.filter(row=>encounter.willMoveToGroup(row,'combat')))
  const returnTargets=computed(()=>selected.value.filter(row=>row.position==='combat'))
  function clear(){encounter.clearSelection()}
  function setVisibleSelection(rows,checked){
    const ids=new Set(items.value.map(row=>row.uid))
    for(const row of new Map(rows.map(row=>[row.uid,row])).values())if(ids.has(row.uid)&&encounter.isSelected(row)!==checked)encounter.toggleSelected(row)
  }
  watch(()=>items.value.map(row=>row.uid),(ids,previous=[])=>{
    const live=new Set(ids)
    for(const id of previous)if(!live.has(id))encounter.unselect(id)
  })
  return {items,selected,damageTargets,experienceTargets,supportsExperience,moveTargets,returnTargets,clear,setVisibleSelection}
}
