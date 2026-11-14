import { createApp, h, reactive, computed } from 'vue'
import { createPinia } from 'pinia'
import { Layers, Images, Route } from '@lucide/vue'
import SessionWorkspaceSidebar from '../../../src/features/sessions/components/SessionWorkspaceSidebar.vue'
import SessionParticipantCard from '../../../src/features/sessions/components/SessionParticipantCard.vue'
import MapSidebar from '../../../src/features/maps/components/MapSidebar.vue'
import { useSessionSidebar } from '../../../src/features/sessions/composables/useSessionSidebar'
import { useTemplateStore } from '../../../src/stores/template'
import { useSuggestStore } from '../../../src/stores/suggest'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'
import '../../../src/features/sessions/pages/styles/ViewSession.css'
const pinia = createPinia()
useTemplateStore(pinia).templates = [{ id:1, name:'DND5' }]
useSuggestStore(pinia).set(3, [])
document.body.style.cssText='margin:0;background:var(--bg);font:14px/1.4 var(--font-ui);color:var(--text-1)'
const state=reactive({view:'story',mapTab:'tiles',worldTab:'maps',draft:'',selections:0})
const participant=reactive({charId:1,charUuid:'test-player',templateId:1,sourceVersionId:1,data:{values:{name:'Тиф',hp:{current:18,max:{base:24,bonuses:[]},temp:5},lvl:{level:5},DEX:{value:14},WIS:{value:16,skills:{10:{up:1}}},INT:{value:14,skills:{9:{up:2}}},armor:{},states:[{uid:'bless',effect_id:701,duration:{kind:'minutes',value:1}}]}}})
window.sidebarState=state
window.fetch=async(input)=>{
  const path=new URL(input,location.origin).pathname
  return Response.json(path==='/api/items/by-ids'?{items:[{id:701,typeId:15,name:'Благословение',svg:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>',data:{polarity:'positive'}}]}:{items:[]})
}
createApp({setup(){
  const sidebar=useSessionSidebar(computed(()=>state.view))
  const mapTabs=[{key:'tiles',label:'Плитки',icon:Layers}],worldTabs=[{key:'maps',label:'Карты мира',icon:Images},{key:'routes',label:'Маршруты',icon:Route}]
  return()=>h('main',{class:'campaign-workspace',style:'height:100dvh;--session-toolbar-height:64px'},[
    h('header',{style:'height:64px;background:var(--subheader);padding:20px;box-sizing:border-box;color:var(--text-1)'},'Поход'),
    h('div',{style:'margin:24px 100px;color:var(--text-1)'},state.view),
    h(MapSidebar,{workspaceKey:'maps',tabs:mapTabs,tab:state.mapTab,'onUpdate:tab':key=>state.mapTab=key,onSelect:()=>state.selections++},()=>h('input',{'aria-label':'Черновик карты',value:state.draft,onInput:event=>state.draft=event.target.value})),
    h(MapSidebar,{workspaceKey:'globalMaps',tabs:worldTabs,tab:state.worldTab,'onUpdate:tab':key=>state.worldTab=key},()=>h('div',{'data-testid':'world-panel'},state.worldTab)),
    h(SessionWorkspaceSidebar,{controller:sidebar},()=>h(SessionParticipantCard,{participant,isDm:true})),
  ])
}}).use(pinia).mount('#app')
