import { expect, test } from '@playwright/test'
import { fixture } from './fixtures/character-layout.js'

const activePane = '.mobile-swipe-pane:not([inert]) .mobile-pane-scroll'

async function expectViewport(page, root, scroller) {
  await expect(scroller).toBeVisible({ timeout: 15000 })
  await page.evaluate(() => document.fonts.ready)
  await root.evaluate(async node => {
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
    const pending=[]
    for(let current=node;current;current=current.parentElement) {
      for(const animation of current.getAnimations()) {
        if(animation.effect?.getTiming().iterations!==Infinity) pending.push(animation.finished.catch(()=>{}))
      }
    }
    await Promise.all(pending)
  })
  const geometry = () => scroller.evaluate(node => {
    const owner=node.closest('.view,.csm'),parts=[...owner.children].filter(part=>part.matches('[data-sheet-chrome]'))
    const chrome=parts[parts.length-1].getBoundingClientRect(),viewport=node.getBoundingClientRect(),frame=owner.getBoundingClientRect()
    return {top:viewport.top-chrome.bottom,bottom:viewport.bottom-frame.bottom}
  })
  await expect.poll(async () => {
    const value=await geometry()
    return Math.max(Math.abs(value.top),Math.abs(value.bottom))
  }).toBeLessThan(1)
  await expect.poll(()=>scroller.evaluate(node=>node.scrollHeight-node.clientHeight)).toBeGreaterThan(40)
  const header=await root.locator(':scope > [data-sheet-chrome]').first().boundingBox()
  await scroller.evaluate(node=>{node.scrollTop=node.scrollHeight})
  await expect.poll(()=>scroller.evaluate(node=>Math.abs(node.scrollHeight-node.clientHeight-node.scrollTop))).toBeLessThan(1)
  expect((await root.locator(':scope > [data-sheet-chrome]').first().boundingBox()).y).toBeCloseTo(header.y,0)
  const end=await geometry()
  expect(Math.abs(end.top)).toBeLessThan(1)
  expect(Math.abs(end.bottom)).toBeLessThan(1)
  await scroller.evaluate(node=>{node.scrollTop=0})
  await expect(scroller).toHaveJSProperty('scrollTop',0)
}

for(const width of [390,834,1440]) for(const states of [false,true]) {
  test(`page scrollbar viewport stays below the entire header at ${width} (states=${states})`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:600})
    const api=await fixture(page)
    api.document().values.inspiration=states
    await page.route('**/api/handbook/sync?**',route=>route.fulfill({json:{protocol:1,entries:[],hasMore:false,cursor:'empty',visibleIds:[],metadata:{types:[],suggests:{},suggestTypes:[],books:[]}}}))
    await page.goto('/char/test')
    const root=page.locator('.view')
    await expect(page.locator('[data-sheet-navigation]')).toBeVisible({timeout:15000})
    await expectViewport(page,root,page.locator(width<1200?activePane:'.sheet-scroll'))
    expect(api.writes).toEqual([])
    await testInfo.attach(`scroll-viewport-${width}-${states}`,{body:await page.screenshot(),contentType:'image/png'})
  })
  test(`modal scrollbar viewport follows the header and preview notice at ${width} (preview=${states})`,async({page})=>{
    await page.setViewportSize({width,height:400})
    await page.goto(`/tests/tutorials/fixtures/character-sheet-save.html${states?'?preview':''}`)
    const root=page.locator('.csm')
    await expect(page.locator('.character-workspace-header')).toBeVisible({timeout:15000})
    await expect(root.locator('.csm-preview-note')).toHaveCount(states?1:0)
    await expectViewport(page,root,page.locator(width<1200?activePane:'.csm-body'))
  })
}
