import { effectScope, nextTick, reactive, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useRosterSelection } from './useRosterSelection'

describe('sidebar roster selection', () => {
  it('shares mode, retains selections across reserve tabs and clears its whole scope on exit', async () => {
    const scope=effectScope(),players=ref([{uid:'player',type:'player'}]),reserves=ref([{uid:'wolf',type:'npc'},{uid:'owl',type:'npc'}]),active=ref('wolf'),mode=ref(false),selected=ref(new Set())
    const encounter={isSelected:row=>selected.value.has(row.uid),toggleSelected(row){const ids=new Set(selected.value);ids.has(row.uid)?ids.delete(row.uid):ids.add(row.uid);selected.value=ids},unselect(id){selected.value=new Set([...selected.value].filter(uid=>uid!==id))},findParticipant:()=>null,willMoveToGroup:()=>true}
    const options={selecting:mode,getModeItems:()=>[...players.value,...reserves.value]}
    const [party,reserve]=scope.run(()=>[reactive(useRosterSelection(encounter,()=>players.value,options)),reactive(useRosterSelection(encounter,()=>reserves.value.filter(row=>row.uid===active.value),options))])
    try {
      party.toggle()
      expect(reserve.selecting).toBe(true)
      encounter.toggleSelected(reserves.value[0])
      await nextTick()
      active.value='owl'
      await nextTick()
      expect(selected.value.has('wolf')).toBe(true)
      expect(reserve.selected).toEqual([])
      encounter.toggleSelected(reserves.value[1])
      await nextTick()
      expect(reserve.damageTargets.map(row=>row.uid)).toEqual(['owl'])
      reserves.value=reserves.value.filter(row=>row.uid!=='wolf')
      await nextTick()
      expect(selected.value.has('wolf')).toBe(false)
      selected.value=new Set([...selected.value,'external-combatant'])
      party.finish()
      await nextTick()
      expect(reserve.selecting).toBe(false)
      expect([...selected.value]).toEqual(['external-combatant'])
    } finally {scope.stop()}
  })
})
