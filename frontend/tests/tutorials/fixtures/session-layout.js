import { fixture } from './character-layout.js'
import { TUTORIAL_REVISION } from '../../../src/features/tutorials/lib/tutorialIdentity.js'
import { applyDocumentPatches } from '../../../src/shared/lib/documentPatch.js'

export async function sessionLayout(page, {url='/tests/tutorials/fixtures/tutorials.html?page=/sessions/test',participants:customParticipants,encounter:initialEncounter} = {}) {
  await fixture(page)
  await page.route('**/api/handbook/sync?**',route=>route.fulfill({json:{protocol:1,entries:[],hasMore:false,cursor:'empty',visibleIds:[],metadata:{types:[],suggests:{},suggestTypes:[],books:[]}}}))
  await page.addInitScript(() => {
    window.EventSource = class {
      constructor() { setTimeout(() => this.onopen?.(), 0) }
      addEventListener() {}
      removeEventListener() {}
      close() {}
    }
  })
  const states = [{ uid:'bless', effect_id:701, duration:{kind:'minutes',value:1} }, { uid:'poison',effect_id:702 }]
  const participants = customParticipants || ['Лира','Тиф'].map((name,i) => ({ charId:i+1,charUuid:`player-${i}`,templateId:1,sourceVersionId:1,version:1,
    data:{values:{name,hp:{current:18,max:{base:24,bonuses:[]}},lvl:{level:3},DEX:{value:14},armor:{},states:i?[]:states}} }))
  let encounter=initialEncounter || {active:false,round:1,turnIndex:0,combatants:[]},encounterVersion=1
  await page.route(url => url.pathname.startsWith('/api/sessions/') || ['/api/templates','/api/items/by-ids','/api/account/tutorials'].includes(url.pathname), async route => {
    const path = new URL(route.request().url()).pathname
    if(path.endsWith('/encounter')&&route.request().method()==='PATCH') {
      const packet=route.request().postDataJSON()
      encounter=applyDocumentPatches(encounter,packet.patches)
      return route.fulfill({json:{fromVersion:encounterVersion,version:++encounterVersion,patches:packet.patches,mutationId:packet.mutationId}})
    }
    let json = {}
    if(path==='/api/sessions/test')json={session:{uuid:'test',name:'Поход',ownerUserId:1,systemId:1,status:'active',displayCode:'TEST'},participants,myRole:'gm'}
    if(path==='/api/templates')json={templates:[{id:1,name:'DND5'}]}
    if(path==='/api/account/tutorials')json={tutorials:['desktop','mobile'].flatMap(device=>['session-dm','character'].map(flowId=>({flowId,sourceKey:flowId==='character'?'edition:1':'source:1',device,status:'completed',revision:TUTORIAL_REVISION})))}
    if(path.endsWith('/chapter-graph'))json={arcs:[{id:3,name:'Начало пути',order:1}],chapters:[{id:12,arcId:3,number:1,name:'Перевал',status:'planned',positionX:0,positionY:0}],edges:[]}
    if(path.endsWith('/scene-graph'))json={scenes:[{id:31,chapterId:12,name:'Встреча',status:'planned',positionX:0,positionY:0}],edges:[]}
    if(path.endsWith('/block-graph'))json={items:[],edges:[]}
    if(path.endsWith('/encounter'))json={data:encounter,version:encounterVersion}
    if(path.endsWith('/global-maps'))json={maps:[]}
    if(path.endsWith('/maps'))json={maps:[],display:{mapId:null,visible:false,revision:0,camera:{x:0,y:0,cellPixels:64,rotation:0,fit:true}}}
    if(path==='/api/items/by-ids')json={items:[{id:701,typeId:15,name:'Благословение',data:{polarity:'positive'}},{id:702,typeId:15,name:'Отравление',data:{polarity:'negative'}}].map(item=>({...item,svg:'<svg viewBox="0 0 24 24"><path d="M12 2v20M2 12h20" /></svg>'}))}
    await route.fulfill({json})
  })
  await page.goto(url)
  await page.addStyleTag({content:'html,body,#app{margin:0;height:100%;overflow:hidden}body{background:var(--bg);color:var(--text-1);font-family:var(--font-ui)}'})
}
