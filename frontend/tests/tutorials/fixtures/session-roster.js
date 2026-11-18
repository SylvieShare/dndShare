import { sessionLayout } from './session-layout.js'
import { applyDocumentPatches } from '../../../src/shared/lib/documentPatch.js'

export async function rosterSelectionFixture(page,width,{url='/sessions/test',beforeImpact}={}) {
  await page.setViewportSize({width,height:980})
  const errors=[],warnings=[]
  page.on('pageerror',error=>{errors.push(String(error));throw error})
  page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('[Vue warn]'))warnings.push(m.text())})
  const participants=['Лира','Тиф'].map((name,i)=>({charId:i+1,charUuid:`player-${i}`,templateId:1,sourceVersionId:1,version:1,data:{values:{name,lvl:{level:3,exp:700},hp:{current:18,max:{base:24,bonuses:[]},temp:2},DEX:{value:14},armor:{},states:[]}}}))
  const encounter={active:false,round:0,turnIndex:0,combatants:[...participants.map(p=>({uid:'p-'+p.charId,type:'player',charId:p.charId,charUuid:p.charUuid,position:'reserve',initiative:null})),
    {uid:'wolf',type:'npc',position:'reserve',override:{name:'Волк',hp:20,ac:14},hpCurrent:15,markerLetter:'A',effectInstances:[{uid:'npc-bless',effect_id:701,duration:{kind:'rounds',value:2}}]}]}
  const api=await sessionLayout(page,{url,participants,encounter})
  const writes=[],impacts=[]
  await page.route(url=>/^\/api\/char\/player-\d\/(data|changes)$/.test(url.pathname),async route=>{
    const p=participants.find(p=>route.request().url().includes('/'+p.charUuid+'/'))
    if(route.request().method()==='PATCH') {
      const packet=route.request().postDataJSON();writes.push({uuid:p.charUuid,...packet})
      p.data=applyDocumentPatches(p.data,packet.patches)
      return route.fulfill({json:{fromVersion:p.version,version:++p.version,patches:packet.patches,mutationId:packet.mutationId}})
    }
    await route.fulfill({json:{fromVersion:p.version,version:p.version,patches:[]}})
  })
  await page.route('**/api/sessions/test/save-targets',route=>route.fulfill({json:{targets:[...participants.map(p=>({kind:'character',charUuid:p.charUuid})),...api.encounter().combatants.filter(row=>row.type==='npc'&&row.position!=='dead').map(row=>({kind:'npc',npcUid:row.uid,encounterId:1}))]}}))
  await page.route('**/api/sessions/test/impacts',async route=>{
    const packet=route.request().postDataJSON();impacts.push(packet)
    await beforeImpact?.()
    const rows=packet.targets.map(({target})=>{
      const p=participants.find(p=>p.charUuid===target.charUuid)
      const hp=p?p.data.values.hp:null,npc=api.encounter().combatants.find(row=>row.uid===target.npcUid)
      const before={current:hp?.current ?? npc.hpCurrent,temp:hp?.temp ?? npc?.hpTemp ?? 0}
      const absorbed=Math.min(before.temp,packet.amount),after={current:Math.max(0,before.current-packet.amount+absorbed),temp:before.temp-absorbed}
      if(hp)Object.assign(hp,after);else Object.assign(npc,{hpCurrent:after.current,hpTemp:after.temp})
      return {target,before,after}
    })
    if (rows.some(({target})=>target.kind==='npc')) api.commitEncounter()
    await route.fulfill({json:{event:{data:{impacts:rows}}}})
  })
  return {...api,participants,writes,impacts,errors,warnings}
}
