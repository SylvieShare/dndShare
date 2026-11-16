import {test,expect} from '@playwright/test'
import {sessionLayout} from './fixtures/session-layout.js'
import {encounterColumnsMinWidth} from '../../src/features/sessions/lib/encounterLayout.js'
import {spacingTokens} from '../../src/app/design-tokens.js'

test('combat commands occupy their own column and both columns scroll independently',async({page},info)=>{
  page.on('pageerror',error=>{throw error})
  await page.setViewportSize({width:834,height:932})
  const encounter={active:true,round:1,turnIndex:0,combatants:[
    {uid:'goblin',type:'npc',override:{name:'Гоблин',hp:12,ac:13},position:'combat',initiative:18,hpCurrent:12,markerLetter:'A'},
    {uid:'orc',type:'npc',override:{name:'Орк',hp:16,ac:12},position:'combat',initiative:12,hpCurrent:16,markerLetter:'B'},
  ]}
  const api=await sessionLayout(page,{url:'/sessions/test',participants:[],encounter})
  await page.locator('.nested-graph-node[data-graph-node-id="12"]').dblclick()
  await page.locator('.nested-graph-node[data-graph-node-id="31"]').dblclick()
  await expect(page.locator('.session-graph-canvas')).toHaveAttribute('data-level','blocks')
  await page.getByRole('button',{name:/Открыть бой/}).click()
  const root=page.locator('.enc-wrap--workspace'),roster=root.locator('.enc-content'),controls=root.locator('.enc-secondary')
  const preview=page.getByRole('complementary',{name:'Текущий ход'})
  await expect(root.locator('.enc-context-art')).toHaveCount(0)
  await expect(controls.getByRole('button',{name:'Бои сценария',exact:true})).toBeVisible()
  await expect(roster.locator('.enc-icon-btn,.enc-section-icon-btn')).toHaveCount(0)
  await controls.getByRole('button',{name:'Следующий ход',exact:true}).click()
  await expect(root.locator('.enc-row--current')).toContainText('Орк')
  for(const width of [390,704,834,1440,704]) {
    await page.setViewportSize({width,height:932})
    const columns=await root.evaluate((n,gap)=>n.clientWidth-2*gap>=628,spacingTokens.page)
    expect(columns).toBe(width>=834)
    await expect(preview).toHaveCount(columns?1:0)
    await expect.poll(async()=>{
      const a=await roster.boundingBox(),b=await controls.boundingBox()
      return columns?b.x>=a.x+a.width+spacingTokens.large-.5:a.y>=b.y+b.height+spacingTokens.large-.5
    }).toBe(true)
    await expect(root.locator('.enc-row--current')).toContainText('Орк')
    const box=await roster.boundingBox()
    expect(box.height).toBeGreaterThan(48)
    for(const button of await controls.locator('.enc-toolbar button').all()) {
      await button.scrollIntoViewIfNeeded()
      const b=await button.boundingBox(),c=await controls.boundingBox()
      expect(b.x).toBeGreaterThanOrEqual(c.x-.5)
      expect(b.x+b.width).toBeLessThanOrEqual(c.x+c.width+.5)
    }
    await controls.evaluate(n=>{n.scrollTop=0})
    await info.attach(`combat-columns-${width}`,{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'})
  }
  await page.setViewportSize({width:1440,height:932})
  await expect(root).toHaveClass(/enc-wrap--columns/)
  await roster.locator('.enc-combat-primary').evaluate(n=>{const extra=document.createElement('div');extra.style.height='3000px';n.append(extra)})
  await roster.evaluate(n=>{n.scrollTop=500})
  expect(await controls.evaluate(n=>n.scrollTop)).toBe(0)
  await controls.evaluate(n=>{n.scrollTop=200})
  expect(await roster.evaluate(n=>n.scrollTop)).toBe(500)
  expect(await page.evaluate(()=>document.documentElement.scrollTop)).toBe(0)
  await controls.getByRole('button',{name:'Следующий ход',exact:true}).click()
  await expect.poll(()=>api.encounter().round).toBe(2)
  expect(encounterColumnsMinWidth).toBe(628)
})
