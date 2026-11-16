export function experiencePlan(entries, amount) {
  return entries.map(({participant,path}) => ({ participant, path,
    value: Math.min(Number.MAX_SAFE_INTEGER, Math.max(0,Number(path.split('.').reduce((value,key)=>value?.[key],participant.data)) || 0) + amount), done:false }))
}

export async function saveExperiencePlan(plan, persist) {
  const failures=[]
  for (const entry of plan) {
    if (entry.done) continue
    try {
      const result = await persist(entry.participant.charUuid,[{path:entry.path,value:entry.value}],entry.participant,{action:'experience'})
      entry.participant.data = result.data
      entry.participant.version = result.version
      entry.done = true
    } catch (error) { failures.push(error) }
  }
  if (failures.length) throw new Error(`Не удалось начислить опыт: ${failures.length}. Повторите для оставшихся персонажей.`)
}
