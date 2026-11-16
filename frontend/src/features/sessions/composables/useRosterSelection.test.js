import { effectScope, nextTick, reactive, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useRosterSelection } from './useRosterSelection'

vi.mock('../lib/participantView', () => ({ pvHpPath: p => p?.hpPath, pvExperiencePath: p => p?.experiencePath }))

describe('sidebar roster selection', () => {
  it('counts and targets the whole scope, grants experience only to characters and prunes removed actors', async () => {
    const scope=effectScope(),players=ref([{uid:'player',charId:1,type:'player'}]),reserves=ref([{uid:'wolf',type:'npc'},{uid:'owl',type:'npc'}]),selected=ref(new Set())
    const encounter={isSelected:row=>selected.value.has(row.uid),unselect(id){selected.value=new Set([...selected.value].filter(uid=>uid!==id))},findParticipant:()=>({hpPath:'values.hp',experiencePath:'values.lvl.exp'}),willMoveToGroup:()=>true}
    const selection=scope.run(()=>reactive(useRosterSelection(encounter,()=>[...players.value,...reserves.value])))
    try {
      selected.value=new Set(['player','wolf','owl','external-combatant'])
      await nextTick()
      expect(selection.selecting).toBe(true)
      expect(selection.selected.map(row=>row.uid)).toEqual(['player','wolf','owl'])
      expect(selection.damageTargets.map(row=>row.uid)).toEqual(['player','wolf','owl'])
      expect(selection.experienceTargets.map(row=>row.uid)).toEqual(['player'])
      expect(selection.moveTargets.map(row=>row.uid)).toEqual(['player','wolf','owl'])
      reserves.value=reserves.value.filter(row=>row.uid!=='wolf')
      await nextTick()
      expect(selected.value.has('wolf')).toBe(false)
      selection.finish()
      await nextTick()
      expect(selection.selecting).toBe(false)
      expect([...selected.value]).toEqual(['external-combatant'])
    } finally {scope.stop()}
  })
})
