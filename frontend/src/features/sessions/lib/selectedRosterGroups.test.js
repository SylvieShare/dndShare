import { expect,it } from 'vitest'
import { selectedRosterGroups } from './selectedRosterGroups'

it('groups NPC types while keeping players separate and counting each actor once',()=>{
  const rows=[{uid:'p1',type:'player',charId:1},{uid:'p2',type:'player',charId:2},
    {uid:'w1',type:'npc',itemId:10,override:{name:'Альфа'}},{uid:'w2',type:'npc',itemId:10},
    {uid:'custom1',type:'npc',override:{name:'Страж'}},{uid:'custom2',type:'npc',override:{name:'Страж'}}]
  const enc={playerDisplayName:c=>`Игрок ${c.charId}`,getPlayerAva:id=>`blob:player-${id}`,
    npcItem:c=>c.itemId?{name:'Волк',svg:'<svg />'}:null,npcName:c=>c.override?.name||'Волк'}
  const result=selectedRosterGroups([...rows,rows[0],rows[2]],enc)
  expect(result.map(row=>[row.name,row.count])).toEqual([['Игрок 1',1],['Игрок 2',1],['Волк',2],['Страж',2]])
  expect(result[0].url).toBe('blob:player-1')
  expect(result[2].svg).toBe('<svg />')
  expect(rows).toHaveLength(6)
})
