const codes = new Set(['blinded','charmed','deafened','frightened','grappled','incapacitated','invisible','paralyzed','petrified','poisoned','prone','restrained','stunned','unconscious'])
const names = {
  'ослеплён':'blinded','ослеплен':'blinded','слепота':'blinded','очарован':'charmed','обворожение':'charmed',
  'оглох':'deafened','глухота':'deafened','испуган':'frightened','испуг':'frightened','захват':'grappled',
  'недееспособен':'incapacitated','выход из строя':'incapacitated','невидимость':'invisible','невидим':'invisible',
  'парализован':'paralyzed','паралич':'paralyzed','окаменение':'petrified','окаменел':'petrified',
  'отравлен':'poisoned','отравление':'poisoned','сбит с ног':'prone','распластанность':'prone',
  'опутан':'restrained','обездвиженность':'restrained','ошеломлён':'stunned','ошеломлен':'stunned','шок':'stunned','без сознания':'unconscious',
}
export function statusIconItem(entry, failed=false) {
  const item=entry.item
  if(!failed && (item?.iconImageUrl || item?.svg)) return item
  const code=item?.data?.code || names[String(entry.value || '').toLowerCase()]
  return codes.has(code) ? {...item,iconImageUrl:'',svg:`/static/conditions/${code}.svg`} : null
}
