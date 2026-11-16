import { expect, test } from '@playwright/test'
import { rosterSelectionFixture } from './fixtures/session-roster.js'

for(const width of [390,834,1440])test(`roster header, edge scrollbar and brush selection at ${width}`,async({page},info)=>{
  const api=await rosterSelectionFixture(page,width)
  for(let i=2;i<16;i++){
    api.participants.push({...structuredClone(api.participants[0]),charId:i+1,charUuid:`extra-player-${i}`,data:{values:{...structuredClone(api.participants[0].data.values),name:`Игрок ${i+1}`}}})
    api.encounter().combatants.push({uid:`p-${i+1}`,type:'player',charId:i+1,charUuid:`extra-player-${i}`,position:'reserve'})
  }
  const wolf=api.encounter().combatants.find(row=>row.uid==='wolf')
  for(let i=1;i<16;i++)api.encounter().combatants.push({...structuredClone(wolf),uid:`wolf-${i}`,override:{...wolf.override,name:`Волк ${i+1}`}})
  await page.reload()
  const sidebar=page.locator('aside.map-sidebar'),nav=sidebar.getByRole('navigation'),header=sidebar.locator('.map-sidebar-header'),mode=header.getByRole('button',{name:/Режим выбора/})
  if((await sidebar.getAttribute('class')).includes('map-sidebar--collapsed'))await nav.getByRole('button',{name:'Игроки',exact:true}).click()
  await expect(header.locator('.roster-selection')).toBeVisible()
  await expect(header).toHaveCSS('border-bottom-width','0px')
  expect(await header.evaluate(n=>getComputedStyle(n).backgroundColor)).not.toBe(await sidebar.locator('.map-sidebar-panel').evaluate(n=>getComputedStyle(n).backgroundColor))
  await mode.click()
  for(const tab of ['Игроки','Запас']){
    if(tab==='Запас')await nav.getByRole('button',{name:tab,exact:true}).click()
    const list=sidebar.locator('.session-roster-list:visible')
    await expect(list).toHaveAttribute('data-scrollable','true')
    const geometry=await list.evaluate(n=>({right:n.getBoundingClientRect().right,panelRight:n.closest('.map-sidebar-panel').getBoundingClientRect().right,border:parseFloat(getComputedStyle(n.closest('.map-sidebar-panel')).borderRightWidth),gutter:getComputedStyle(n).scrollbarGutter,gap:getComputedStyle(n).gap}))
    expect(geometry.panelRight-geometry.right).toBeCloseTo(geometry.border,0)
    expect(geometry.gutter).toBe('auto');expect(geometry.gap).toBe('0px')
    const row=list.getByRole('checkbox').first(),tile=row.locator('.session-roster-tile'),before=await row.boundingBox()
    await row.click()
    await expect(row).toBeChecked()
    await expect(mode).toContainText('1')
    await expect(tile).toHaveCSS('border-radius','0px')
    await expect.poll(()=>tile.evaluate(n=>getComputedStyle(n,'::before').opacity)).toBe('0.24')
    expect((await row.boundingBox()).height).toBeCloseTo(before.height,1)
    await expect(list.locator('.workspace-row-divider')).toHaveCount(15)
    const top=(await header.boundingBox()).y
    await list.evaluate(n=>n.scrollTop=n.scrollHeight)
    expect((await header.boundingBox()).y).toBe(top)
    await expect(mode).toHaveAttribute('aria-pressed','true')
    await list.evaluate(n=>n.scrollTop=0)
    await info.attach(`roster-${tab}-${width}`,{body:await sidebar.screenshot({animations:'disabled'}),contentType:'image/png'})
  }
  await mode.click()
  await expect(sidebar.getByRole('checkbox')).toHaveCount(0)
  await page.setViewportSize({width,height:2600})
  await expect(sidebar.locator('.session-roster-list:visible')).not.toHaveAttribute('data-scrollable','true')
  expect(api.errors).toEqual([]);expect(api.warnings).toEqual([])
})
