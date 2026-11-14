import {createApp,h,ref} from 'vue'
import {createPinia} from 'pinia'
import HandbookItemDetail from '../../../src/features/handbook/components/HandbookItemDetail.vue'
import {useItemTypesStore} from '../../../src/stores/itemTypes'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'
import '../../../src/app/fonts.css'

const type={id:5,sourceId:1,name:'Заклинания',fields:[],coverImageUrl:'/tests/tutorials/fixtures/spell-covers/default.webp'}
const samples={
 revivify:{id:863,typeId:5,name:'Возрождение',data:{lvl:3,time:{kind:'action'},range:{kind:'touch'},duration:'Мгновенная',components:{v:true,s:true,m:'бриллианты, стоящие в сумме 300 зм, расходуемые заклинанием'},description:'<p>Описание возрождения.</p>'}},
 identify:{id:629,typeId:5,name:'Опознание',data:{lvl:1,time:{kind:'minutes',value:1},range:{kind:'touch'},duration:'Мгновенная',components:{v:true,s:true,m:'жемчужина, стоящая как минимум 100 зм, и перо совы'},description:'<p>Описание опознания.</p>'}},
 counterspell:{id:897,typeId:5,name:'Контрзаклинание',data:{lvl:3,time:{kind:'reaction',condition:'Когда вы видите, как существо в пределах 60 футов накладывает заклинание'},range:{kind:'ranged',distance:60},duration:'Мгновенная',components:{s:true},description:'<p>Описание контрзаклинания.</p>'}},
}
const pinia=createPinia();useItemTypesStore(pinia).types=[type]
const selected=ref(samples[new URLSearchParams(location.search).get('sample')]||samples.revivify)
window.selectSpellSample=key=>selected.value=samples[key]
createApp({render:()=>h('main',{style:'max-width:900px;margin:16px'},h(HandbookItemDetail,{item:selected.value,type,showTitle:true}))}).use(pinia).mount('#app')
