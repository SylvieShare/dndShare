import { createSSRApp,h } from 'vue'
import { createPinia } from 'pinia'
import { renderToString } from 'vue/server-renderer'
import { expect,it } from 'vitest'
import BlockMoney from './BlockMoney.vue'
it('renders a VTM wallet from its explicit currency without a D&D suggest dictionary',async()=>{
  const app=createSSRApp({render:()=>h(BlockMoney,{block:{id:'money',preset:[{id:1,title:'Доллары',short_title:'$',color:'var(--success)'}]},value:{order:[1],amounts:{1:12}}})})
  app.use(createPinia());app.provide('charCtx',{ownerMode:true})
  const html=await renderToString(app)
  expect(html).toContain('Доллары')
  expect(html).toContain('12')
})
