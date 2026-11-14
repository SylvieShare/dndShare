import {expect,test} from '@playwright/test'
import {fixture} from './fixtures/character-layout.js'

test('status cards retain semantic fills and readable captions while their menu is open',async({page},info)=>{
  await page.setViewportSize({width:834,height:700})
  const api=await fixture(page)
  api.document().values.states=[951,952,953,954].map((id,index)=>({uid:`effect-${id}`,effect_id:id,duration:{kind:'minutes',value:index+1}}))
  api.document().values.inspiration=true
  api.document().values.exhaustion={level:2}
  await page.route(url=>url.pathname==='/api/items/by-ids',route=>route.fulfill({json:{items:[
    {id:951,typeId:15,name:'Благословение',data:{polarity:'positive',color:'#1122ff'}},
    {id:952,typeId:15,name:'Отравление',data:{polarity:'negative',code:'poisoned'}},
    {id:953,typeId:15,name:'Метка',data:{polarity:'neutral'}},
    {id:954,typeId:15,name:'Без типа',data:{}},
  ]}}))
  await page.route('**/api/handbook/sync?**',route=>route.fulfill({json:{protocol:1,entries:[],hasMore:false,cursor:'empty',visibleIds:[],metadata:{types:[],suggests:{},suggestTypes:[],books:[]}}}))
  await page.goto('/char/test')
  const header=page.locator('.character-workspace-header')
  await expect(header.locator('.dsov-effect')).toHaveCount(6,{timeout:15000})
  const color=async(name)=>header.getByRole('button',{name,exact:true}).evaluate(node=>{
    const decode=value=>value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>value.startsWith('color(')?v*255:v)
    const bg=decode(getComputedStyle(node).backgroundColor)
    const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)
    const text=[...node.querySelectorAll('.dsov-name,.dsov-duration,.dsov-level')].map(element=>{
      const a=luminance(decode(getComputedStyle(element).color)),b=luminance(bg)
      return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)
    })
    return {bg,polarity:node.dataset.polarity,contrast:Math.min(...text)}
  })
  const positive=await color('Благословение'),negative=await color('Отравление'),neutral=await color('Метка')
  expect(positive.polarity).toBe('positive');expect(positive.bg[1]).toBeGreaterThan(Math.max(positive.bg[0],positive.bg[2]))
  expect(negative.polarity).toBe('negative');expect(negative.bg[0]).toBeGreaterThan(Math.max(negative.bg[1],negative.bg[2]))
  expect(neutral.polarity).toBe('neutral');expect(neutral.bg[2]).toBeGreaterThan(Math.max(neutral.bg[0],neutral.bg[1]))
  expect((await color('Без типа')).bg).toEqual(neutral.bg)
  expect((await color('Вдохновение')).bg).toEqual(positive.bg)
  expect((await color('Истощение')).bg).toEqual(negative.bg)
  for(const name of ['Благословение','Отравление','Метка','Без типа','Истощение'])expect((await color(name)).contrast,name).toBeGreaterThanOrEqual(4.5)
  const button=header.getByRole('button',{name:'Благословение',exact:true})
  await expect(button).toHaveAttribute('aria-description',/Положительный/)
  await button.click();await expect(button).toHaveClass(/action-menu-source--open/)
  await expect.poll(async()=>{const {bg}=await color('Благословение');return bg[1]-bg[0]}).toBeGreaterThan(positive.bg[1]-positive.bg[0])
  expect((await color('Благословение')).contrast).toBeGreaterThanOrEqual(4.5)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(api.writes).toEqual([])
  await info.attach('semantic-status-cards',{body:await page.screenshot(),contentType:'image/png'})
})
