import { createApp, h, reactive, computed, ref } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import DndUtilities from '../../../src/features/character-editor/components/sheet/DndUtilities.vue'
import CharacterWorkspaceHeader from '../../../src/features/character-editor/components/CharacterWorkspaceHeader.vue'
import '../../../src/features/character-editor/components/sheet/sheetLayout.css'
import schema from '../../../src/features/character-editor/settings/dnd/definition'
import { blankValues } from '../../../src/features/character-editor/settings/dnd/newCharacter'
import { characterSheetContext } from '../../../src/features/character-editor/lib/sheetContext'
import { useDiceStore } from '../../../src/stores/dice'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

const pinia = createPinia()
document.body.style.cssText='margin:0;background:var(--bg)'
const ownerMode = !new URLSearchParams(location.search).has('readonly')
const values = reactive(blankValues())
Object.assign(values,{speed:{base:30,bonuses:[]},initiative:{base:1,bonuses:[],use_dex:true},prof_bonus:{v:3,auto:true,bonuses:[]},lvl:{level:5,exp:6500},DEX:{...values.DEX,value:{base:14,bonuses:[]}}})
window.utilityValues=values
const ctx = reactive({ ownerMode, canEdit: ownerMode, rulesVersion: '2014', values,
  characterArmor:{state:{total:16,dexterity:2,speedPenalty:10,strengthRequired:15,body:{name:'Тяжёлый доспех',value:16,item:{data:{category:'heavy',armor:{use_dex:false}}}},nonproficient:[],abilityBonuses:[]}},
  characterDerivedEffects:{speed:()=>({total:5,multiplier:1,sources:[]}),bonus:(kind,context)=>({total:kind==='check_bonus'&&context?.kind==='initiative'?2:0})},
})
window.rolls = []
window.writes = []
const dice = useDiceStore(pinia)
dice.rollD20 = (...args) => window.rolls.push({ kind: 'd20', args })
dice.roll = (...args) => window.rolls.push({ kind: 'roll', args })
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
const format=innerWidth>=1200?'desktop':innerWidth<600?'phone':'tablet'
createApp({ render: () => h('main', { class: 'character-sheet' }, [h(CharacterWorkspaceHeader,{dnd:true,format,compact:format!=='desktop',name:'Лира',subtitle:'Воин'}),h('aside',{class:'test-utilities',style:'margin:24px;width:280px'},[h(DndUtilities)])]) })
  .use(pinia).use(router).provide('charCtx', ctx).provide(characterSheetContext, {
    definition: ref(schema), values: computed(() => values), vars: ref({}),
    updateValue: patch => {window.writes.push(patch);values[patch.id]=patch.value}, updateVar: () => {},
  }).mount('#app')
