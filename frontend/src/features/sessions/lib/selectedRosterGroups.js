export function selectedRosterGroups(rows,encounter) {
  const groups=new Map(),seen=new Set()
  for(const row of rows){
    if(!row?.uid||seen.has(row.uid))continue
    seen.add(row.uid)
    const player=row.type==='player',item=player?null:encounter.npcItem(row)
    const name=String((player?encounter.playerDisplayName(row):(item?.name||encounter.npcName(row)))||(player?'Персонаж':'Существо'))
    const key=player?`player:${row.charId??row.charUuid??row.uid}`:row.itemId!=null?`npc:item:${row.itemId}`:`npc:custom:${String(encounter.npcName(row)).trim().toLocaleLowerCase('ru')}`
    if(!groups.has(key)){
      const art=player?(encounter.getPlayerAva(row.charId)||''):(item?.iconImageUrl||item?.svg||(item?.iconSvgId?`/api/svg/${item.iconSvgId}`:''))
      const inline=!player && !item?.iconImageUrl && art.trim().startsWith('<')
      groups.set(key,{key,player,name,count:0,url:inline?'':art,svg:inline?art:''})
    }
    groups.get(key).count++
  }
  return [...groups.values()]
}
