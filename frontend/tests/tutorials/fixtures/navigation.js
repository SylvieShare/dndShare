import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ChapterGraphToolbar from '../../../src/features/sessions/components/ChapterGraphToolbar.vue'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

const isDm = new URLSearchParams(location.search).get('role') !== 'player'
const app = createApp({ setup() {
  const view = ref('story'), combat = ref(false)
  return () => h('main', {style:'height:100dvh;container-type:inline-size'}, [
    h(ChapterGraphToolbar, {
      session: {uuid:'navigation',name:'Приключение',status:'stopped'}, isDm,
      primaryView:view.value,combatActive:combat.value,encounterActive:true,
      'onSelect-view': key => {view.value=key;combat.value=false},
      'onOpen-combat': () => {view.value='story';combat.value=!combat.value},
    }),
    h('p', {'data-view':view.value}, view.value),
  ])
} })
app.use(createPinia())
app.use(createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]}))
app.mount('#app')
