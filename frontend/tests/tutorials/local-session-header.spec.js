import { expect,test } from '@playwright/test'

async function open(page,width,longTitle=false){
  page.on('pageerror',error=>{throw error})
  await page.setViewportSize({width,height:700})
  await page.route(url=>url.pathname.startsWith('/api/'),route=>route.fulfill({json:{items:[],sources:[],events:[]}}))
  await page.goto(`/tests/tutorials/fixtures/local-session-header.html${longTitle?'?long':''}`)
  await expect(page.locator('[data-tutorial="session-navigation"]')).toBeVisible({timeout:15000})
  await page.evaluate(()=>document.fonts.ready)
}
for(const width of [390,834,1440])test(`session tabs use a local surface at ${width}`,async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await open(page,width)
  const header=page.locator('.chapter-toolbar'),navigation=header.locator('[data-tutorial="session-navigation"]')
  await expect(navigation).toHaveAttribute('data-workspace-navigation',width<600?'phone':'tablet')
  const placement=await navigation.evaluate(node=>{
    const main=node.closest('.workspace-header').querySelector('.workspace-header-inner').getBoundingClientRect(),nav=node.getBoundingClientRect()
    return {inMain:!!node.closest('.workspace-header-inner'),top:nav.top-main.top,bottom:main.bottom-nav.bottom}
  })
  expect(placement.inMain).toBe(width>=1200)
  if(width>=1200){expect(placement.top).toBeGreaterThanOrEqual(0);expect(placement.bottom).toBeGreaterThanOrEqual(0);await expect(navigation).toHaveClass(/share-icon-navigation--stacked/)}
  await navigation.getByRole('button',{name:'Карта',exact:true}).click()
  await expect(page.locator('.session-header-test-body h1')).toHaveText('maps')
  await expect(navigation.getByRole('button',{name:'Карта',exact:true})).toHaveAttribute('aria-current','page')
  expect(await page.evaluate(()=>window.sessionHeaderActions)).toEqual(['maps'])
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await testInfo.attach(`session-local-header-${width}`,{body:await page.screenshot(),contentType:'image/png'})
  expect(errors).toEqual([])
})
test('session navigation keeps one DOM instance and its selection across formats',async({page})=>{
  await open(page,1440)
  const nav=page.locator('[data-tutorial="session-navigation"]'),map=nav.getByRole('button',{name:'Карта',exact:true})
  await map.click()
  await map.focus()
  await page.evaluate(()=>{window.originalSessionNavigation=document.querySelector('[data-tutorial="session-navigation"]')})
  await page.setViewportSize({width:834,height:700})
  await expect(page.locator('.chapter-toolbar')).not.toHaveClass(/workspace-header--navigation-inline/)
  await expect(map).toHaveAttribute('aria-current','page')
  await expect(map).toBeFocused()
  expect(await page.evaluate(()=>window.originalSessionNavigation===document.querySelector('[data-tutorial="session-navigation"]'))).toBe(true)
  await page.setViewportSize({width:1440,height:700})
  await expect(page.locator('.chapter-toolbar')).toHaveClass(/workspace-header--navigation-inline/)
  await expect(map).toHaveAttribute('aria-current','page')
  await expect(map).toBeFocused()
  expect(await page.evaluate(()=>window.originalSessionNavigation===document.querySelector('[data-tutorial="session-navigation"]'))).toBe(true)
})

test('a long session title leaves room for navigation in a narrow desktop window',async({page})=>{
  await open(page,1200,true)
  const main=page.locator('.chapter-toolbar .workspace-header-inner'),nav=page.locator('[data-tutorial="session-navigation"]')
  expect((await nav.boundingBox()).width).toBeGreaterThan((await main.boundingBox()).width*.35)
  await nav.getByRole('button',{name:'Карта',exact:true}).click()
  await expect(page.locator('.session-header-test-body h1')).toHaveText('maps')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1200)
})
