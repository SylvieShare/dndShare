import { expect,test } from '@playwright/test'
import { fixture } from '../tutorials/fixtures/character-layout'

async function api(page) {
  await fixture(page)
  await page.route(url=>url.pathname==='/api/maps',route=>route.fulfill({json:[]}))
  await page.route('**/api/handbook/sync?**',route=>route.fulfill({json:{protocol:1,entries:[],hasMore:false,cursor:'empty',visibleIds:[],metadata:{types:[],suggests:{},suggestTypes:[],books:[]}}}))
  await page.route('**/api/admin/stats',route=>route.fulfill({json:{users:0,characters:0,templates:0,logs:0,baseItems:0}}))
}
for(const width of [390,834,1440]) for(const path of ['/handbook','/chars','/sessions','/maps','/account','/admin']) {
  test(`shared page chrome on ${path} at ${width}`,async({page},testInfo)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message))
    await page.setViewportSize({width,height:700});await api(page);await page.goto(path)
    const header=page.locator('.app-header')
    await expect(header).toBeVisible({timeout:15000})
    await expect(header).toHaveCSS('background-color','rgb(48, 42, 61)')
    await expect(header.locator('.workspace-header-backdrop')).toHaveCount(0)
    await expect(header.locator('.workspace-subheader')).toHaveCount(0)
    if(['/chars','/sessions'].includes(path)) await expect(header.getByRole('heading',{name:path==='/chars'?'Персонажи':'Сессии',level:1,exact:true})).toBeVisible()
    await page.evaluate(()=>{const fill=document.createElement('div');fill.style.height='1600px';document.querySelector('.page-transition-stage').appendChild(fill)})
    await page.evaluate(()=>scrollTo(0,120))
    await expect(header).toHaveAttribute('data-workspace-scrolled','')
    expect((await header.boundingBox()).y).toBeCloseTo(0,0)
    await page.evaluate(()=>scrollTo(0,0))
    await expect(header).not.toHaveAttribute('data-workspace-scrolled')
    expect(await header.evaluate(node=>getComputedStyle(node,'::after').visibility)).toBe('hidden')
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect(errors).toEqual([])
    await testInfo.attach(`site-header-${path.slice(1)}-${width}`,{body:await page.screenshot(),contentType:'image/png'})
  })
}

test('page navigation portals switch cleanly when returning to the cached character list',async({page})=>{
  await api(page);await page.goto('/chars')
  await expect(page.locator('#app-header-actions').getByRole('button',{name:'Новый персонаж',exact:true})).toBeVisible()
  await page.locator('.app-sidebar').getByText('Сессии',{exact:true}).click()
  await expect(page.getByRole('navigation',{name:'Категории сессий'})).toBeVisible()
  await expect(page.locator('.app-header').getByRole('navigation',{name:'Категории сессий'})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Новый персонаж',exact:true})).toHaveCount(0)
  await page.goBack()
  await expect(page.locator('#app-header-actions').getByRole('button',{name:'Новый персонаж',exact:true})).toBeVisible()
  await expect(page.getByRole('navigation',{name:'Категории сессий'})).toHaveCount(0)
})

for(const width of [390,834,1440]) test(`creation uses one common header at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:750});await api(page);await page.goto('/chars/new')
  await expect(page.locator('.cc-head')).toBeVisible({timeout:15000})
  await expect(page.locator('.app-header')).toHaveCount(0)
  await expect(page.locator('.cc-head')).toHaveCSS('background-color','rgb(48, 42, 61)')
  await expect(page.locator('.cc-head .workspace-header-backdrop')).toHaveCount(0)
  await page.locator('.cc-head').getByRole('button',{name:'Закрыть создание персонажа'}).click()
  await expect(page.locator('#app-header-actions').getByRole('button',{name:'Новый персонаж',exact:true})).toBeVisible()
})

test('nested content columns keep elevation while either visible column is scrolled',async({page})=>{
  await api(page);await page.goto('/handbook')
  await expect(page.locator('.app-header')).toBeVisible()
  await page.evaluate(()=>{
    const stage=document.querySelector('.page-transition-stage')
    for(const id of ['left-test-scroll','right-test-scroll']) {
      const node=document.createElement('div');node.id=id;node.dataset.workspaceScroll='';node.style.cssText=`position:fixed;top:200px;left:${id.startsWith('left')?300:450}px;width:120px;height:100px;overflow:auto`
      const content=document.createElement('div');content.style.height='600px';node.append(content);stage.append(node)
    }
    document.querySelector('#left-test-scroll').scrollTop=40
  })
  const header=page.locator('.app-header')
  await expect(header).toHaveAttribute('data-workspace-scrolled','')
  await page.locator('#right-test-scroll').evaluate(node=>{node.scrollTop=30})
  await page.locator('#right-test-scroll').evaluate(node=>{node.scrollTop=0;node.dispatchEvent(new Event('scroll'))})
  await expect(header).toHaveAttribute('data-workspace-scrolled','')
  await page.locator('#left-test-scroll').evaluate(node=>{node.scrollTop=0})
  await expect(header).not.toHaveAttribute('data-workspace-scrolled')
})

for(const width of [390,1440])test(`session list actions and joining stay usable at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:750});await api(page)
  await page.route(url=>url.pathname==='/api/sessions',route=>route.fulfill({json:[{session:{id:1,uuid:'test',name:'Пепельная корона',status:'stopped',systemId:1},participants:[],myRole:'gm'}]}))
  let requested=''
  await page.route(url=>url.pathname.startsWith('/api/sessions/by-code/'),route=>{requested=new URL(route.request().url()).pathname;return route.fulfill({status:404,json:{desc:'Сессия не найдена'}})})
  await page.goto('/sessions')
  const header=page.locator('.app-header'),code=page.getByRole('textbox',{name:'Код приглашения в сессию',exact:true})
  await expect(header.getByRole('heading',{name:'Сессии',level:1,exact:true})).toBeVisible()
  await expect(header.getByRole('button',{name:'Создать сессию',exact:true})).toBeVisible()
  await expect(header.getByRole('textbox')).toHaveCount(0)
  await code.fill('ABCDE-12345');await code.press('Enter')
  await expect(page.getByRole('alert')).toHaveText('Сессия с таким кодом не найдена')
  expect(requested).toBe('/api/sessions/by-code/ABCDE-12345')
  await header.getByRole('button',{name:'Создать сессию',exact:true}).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})
