import { test,expect } from '@playwright/test'
import { sessionLayout } from './fixtures/session-layout.js'
import { encounterColumnsMinWidth } from '../../src/features/sessions/lib/encounterLayout.js'
import { layoutTokens,spacingTokens } from '../../src/app/design-tokens.js'

test('combat preview follows available workspace width and preserves turn controls',async({page},info)=>{
  page.on('pageerror',error=>{throw error})
  await page.setViewportSize({width:704,height:932})
  const encounter={active:true,round:1,turnIndex:0,combatants:[
    {uid:'goblin',type:'npc',override:{name:'Гоблин',hp:12,ac:13},position:'combat',initiative:18,hpCurrent:12},
    {uid:'orc',type:'npc',override:{name:'Орк',hp:16,ac:12},position:'combat',initiative:12,hpCurrent:16},
  ]}
  await sessionLayout(page,{url:'/sessions/test',encounter})
  await page.locator('.nested-graph-node[data-graph-node-id="12"]').dblclick()
  await page.locator('.nested-graph-node[data-graph-node-id="31"]').dblclick()
  await expect(page.locator('.session-graph-canvas')).toHaveAttribute('data-level','blocks')
  await page.getByRole('button',{name:/Открыть бой/}).click()
  const root=page.locator('.enc-wrap--workspace'),preview=page.getByRole('complementary',{name:'Текущий ход'})
  await expect(root).toBeVisible()
  await expect(root.getByRole('button',{name:'Бои сценария',exact:true})).toBeVisible()
  await expect(page.locator('.page-forward-enter-active,.page-backward-enter-active')).toHaveCount(0)
  await expect(preview).toHaveCount(0)
  await page.getByRole('button',{name:'Следующий ход',exact:true}).click()
  await expect(page.locator('.enc-row--current')).toContainText('Орк')
  const samples=[]
  for(const [width,visible] of [[390,false],[704,false],[1440,true],[704,false]]) {
    await page.setViewportSize({width,height:932})
    await expect(preview).toHaveCount(visible?1:0)
    let geometry
    await expect.poll(async()=>{
      geometry=await root.evaluate((node,gutter)=>{
        const rect=selector=>node.querySelector(selector).getBoundingClientRect().toJSON()
        const bounds=node.getBoundingClientRect().toJSON(),header=rect('.enc-toolbar'),content=rect('.enc-content'),primary=rect('.enc-combat-primary')
        const buttons=[...node.querySelectorAll('.enc-toolbar button')].filter(button=>button.getClientRects().length).map(button=>button.getBoundingClientRect().toJSON())
        return {bounds,header,content,primary,buttons,aside:node.querySelector('.turn-preview')?.getBoundingClientRect().toJSON() || null,available:node.clientWidth-2*gutter}
      },spacingTokens.page)
      return Math.abs(geometry.header.left-geometry.bounds.left-spacingTokens.page)<1
        && Math.abs(geometry.bounds.right-geometry.header.right-spacingTokens.page)<1
        && Math.abs(geometry.content.left-geometry.bounds.left-spacingTokens.page)<1
        && geometry.content.top>=geometry.header.bottom+spacingTokens.large-1
        && geometry.buttons.every(box=>box.left>=geometry.header.left-.5&&box.right<=geometry.header.right+.5&&box.top>=geometry.header.top-.5&&box.bottom<=geometry.header.bottom+.5)
    }).toBe(true)
    const rail=await page.getByRole('navigation',{name:'Боковые вкладки сессии'}).boundingBox()
    expect(geometry.bounds.left).toBeGreaterThanOrEqual(rail.x+rail.width-.5)
    expect(geometry.available>=encounterColumnsMinWidth).toBe(visible)
    await expect(page.locator('.enc-row--current')).toContainText('Орк')
    await expect.poll(()=>page.locator('.enc-rows .p-name-text').evaluateAll(nodes=>Math.min(...nodes.map(node=>parseFloat(getComputedStyle(node).fontSize))))).toBeGreaterThanOrEqual(10)
    if(visible){
      await expect(preview).toContainText('Орк')
      expect(geometry.aside.width).toBeGreaterThanOrEqual(layoutTokens['encounter-preview-min-width'])
      expect(geometry.aside.left).toBeGreaterThanOrEqual(geometry.primary.right+spacingTokens.large-.5)
      expect(geometry.aside.right).toBeLessThanOrEqual(geometry.content.right+.5)
    }
    samples.push({width,preview:visible,...geometry})
    await info.attach(`combat-${width}-${samples.length}`,{body:await root.screenshot({animations:'disabled'}),contentType:'image/png'})
  }
  await page.setViewportSize({width:900,height:932})
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const available=await root.evaluate((node,gutter)=>node.clientWidth-2*gutter,spacingTokens.page),boundary=900+encounterColumnsMinWidth-available
  for(const [width,visible] of [[boundary-1,false],[boundary,true],[boundary+1,true]]){
    await page.setViewportSize({width,height:932})
    await expect(preview).toHaveCount(visible?1:0)
  }
  await info.attach('combat-layout-geometry',{body:Buffer.from(JSON.stringify({samples,boundary})),contentType:'application/json'})
})
