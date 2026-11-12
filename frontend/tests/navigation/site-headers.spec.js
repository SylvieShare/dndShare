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
    await expect(header).toHaveCSS('background-color','rgb(53, 49, 63)')
    await expect(header.locator('.workspace-header-backdrop')).toHaveCount(0)
    if(['/chars','/sessions','/maps','/account'].includes(path)) await expect(header.locator('.workspace-subheader')).toBeVisible()
    await page.evaluate(()=>{const fill=document.createElement('div');fill.style.height='1600px';document.querySelector('.page-transition-stage').appendChild(fill)})
    await page.evaluate(()=>scrollTo(0,120))
    await expect(header).toHaveAttribute('data-workspace-scrolled','')
    expect((await header.boundingBox()).y).toBeCloseTo(0,0)
    await page.evaluate(()=>scrollTo(0,0))
    await expect(header).not.toHaveAttribute('data-workspace-scrolled')
    expect(await header.evaluate(node=>getComputedStyle(node,'::after').visibility)).toBe('hidden')
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect(errors).toEqual([])
    if(path==='/sessions') await testInfo.attach(`site-header-${width}`,{body:await page.screenshot(),contentType:'image/png'})
  })
}

test('page navigation portals switch cleanly when returning to the cached character list',async({page})=>{
  await api(page);await page.goto('/chars')
  await expect(page.locator('#app-subheader').getByRole('button',{name:'Новый персонаж',exact:true})).toBeVisible()
  await page.locator('.app-sidebar').getByText('Сессии',{exact:true}).click()
  await expect(page.locator('#app-subheader').getByRole('navigation',{name:'Категории сессий'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Новый персонаж',exact:true})).toHaveCount(0)
  await page.goBack()
  await expect(page.locator('#app-subheader').getByRole('button',{name:'Новый персонаж',exact:true})).toBeVisible()
  await expect(page.getByRole('navigation',{name:'Категории сессий'})).toHaveCount(0)
})

for(const width of [390,834,1440]) test(`creation uses one common header at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:750});await api(page);await page.goto('/chars/new')
  await expect(page.locator('.cc-head')).toBeVisible({timeout:15000})
  await expect(page.locator('.app-header')).toHaveCount(0)
  await expect(page.locator('.cc-head')).toHaveCSS('background-color','rgb(53, 49, 63)')
  await expect(page.locator('.cc-head .workspace-header-backdrop')).toHaveCount(0)
  await page.locator('.cc-head').getByRole('button',{name:'Закрыть создание персонажа'}).click()
  await expect(page.locator('#app-subheader').getByRole('button',{name:'Новый персонаж',exact:true})).toBeVisible()
})
