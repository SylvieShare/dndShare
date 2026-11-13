import { expect,test } from '@playwright/test'
import { fixture } from '../tutorials/fixtures/character-layout.js'
import { TUTORIAL_REVISION } from '../../src/features/tutorials/lib/tutorialIdentity.js'

for(const width of [390,834,1440])test(`the real session workspace places its local tabs correctly at ${width}`,async({page},testInfo)=>{
  page.on('pageerror',error=>{throw error})
  await page.setViewportSize({width,height:750})
  await fixture(page)
  await page.addInitScript(()=>{
    window.EventSource=class {readyState=1;constructor(){setTimeout(()=>this.onopen?.(),0)}addEventListener(){}removeEventListener(){}close(){}}
  })
  await page.route(url=>url.pathname==='/api/sessions/test',route=>route.fulfill({json:{session:{uuid:'test',name:'Пепельная корона',ownerUserId:1,systemId:1,status:'stopped'},participants:[],myRole:'gm'}}))
  await page.route(url=>url.pathname==='/api/sessions/test/maps',route=>route.fulfill({json:{maps:[],display:{mapId:null,visible:false,revision:0,camera:{x:0,y:0,cellPixels:64,rotation:0,fit:true}}}}))
  await page.route(url=>url.pathname==='/api/sessions/test/global-maps',route=>route.fulfill({json:{maps:[]}}))
  await page.route(url=>url.pathname==='/api/account/tutorials',route=>route.fulfill({json:{tutorials:['mobile','desktop'].map(device=>({flowId:'session-dm',sourceKey:'source:1',device,status:'completed',revision:TUTORIAL_REVISION}))}}))
  await page.goto('/sessions/test')
  const header=page.locator('.chapter-toolbar'),nav=header.locator('[data-tutorial="session-navigation"]')
  await expect(nav).toBeVisible({timeout:15000})
  await expect(page.locator('.app-header')).toHaveCount(0)
  await expect(page.locator('.app-sidebar')).toHaveCount(0)
  expect(await nav.evaluate(node=>!!node.closest('.workspace-header-inner'))).toBe(width>=1200)
  await expect(nav).toHaveAttribute('data-workspace-navigation',width<600?'phone':'tablet')
  await nav.getByRole('button',{name:'Карта',exact:true}).click()
  await expect(nav.getByRole('button',{name:'Карта',exact:true})).toHaveAttribute('aria-current','page')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await testInfo.attach(`session-workspace-${width}`,{body:await page.screenshot(),contentType:'image/png'})
  await page.getByRole('button',{name:'К списку сессий',exact:true}).click()
  await expect(page.locator('.app-header').getByRole('heading',{name:'Сессии',exact:true})).toBeVisible()
  await expect(page.locator('.app-header .workspace-subheader')).toHaveCount(0)
})
