import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import ChapterGraphToolbar from '../../../src/features/sessions/components/ChapterGraphToolbar.vue'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

const router=createRouter({history:createMemoryHistory(),routes:[{path:'/sessions',name:'Sessions',component:{render:()=>null}},{path:'/sessions/test',name:'Session',component:{render:()=>null}}]})
await router.push('/sessions/test')
window.sessionHeaderActions=[]
const longTitle=new URLSearchParams(location.search).has('long')
createApp({setup(){
  const primaryView=ref('story'),combat=ref(false)
  const arc={id:'arc',name:'Забытый храм',order:1}
  return()=>h('main',{class:'session-header-test',style:'display:flex;flex-direction:column;height:100dvh;overflow:hidden;background:var(--bg);color:var(--text-1)'},[
    h(ChapterGraphToolbar,{session:{uuid:'test',name:longTitle?'Пепельная корона с очень длинным названием '.repeat(8):'Пепельная корона',status:'stopped',ownerUserId:1},isDm:true,arcs:[arc],selectedArc:arc,currentArc:arc,primaryView:primaryView.value,combatActive:combat.value,
      onSelectView:key=>{primaryView.value=key;window.sessionHeaderActions.push(key)},onOpenCombat:()=>{combat.value=!combat.value}}),
    h('section',{class:'session-header-test-body',style:'flex:1;min-height:0;overflow:auto;padding:20px'},[h('h1',{style:'font:inherit'},primaryView.value),h('div',{style:'height:1200px'})]),
  ])
}}).use(createPinia()).use(router).mount('#app')
