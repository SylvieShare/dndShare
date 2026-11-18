import { expect,test } from '@playwright/test'
import { rosterSelectionFixture } from './fixtures/session-roster.js'

test('deselecting the active creature fades its tint, brush and swords together', async ({ page }, info) => {
  const api = await rosterSelectionFixture(page, 932)
  const fight = api.encounter()
  const wolf = fight.combatants.find(row => row.uid === 'wolf')
  Object.assign(wolf, { position: 'combat', initiative: 18 })
  Object.assign(fight, { active: true, round: 1, turnIndex: 0 })
  await page.setViewportSize({ width: 932, height: 704 })
  await page.reload()
  await page.getByRole('button', { name: /Открыть бой/ }).click()
  const sidebar = page.locator('aside.map-sidebar')
  await sidebar.getByRole('navigation').getByRole('button', { name: 'Запас', exact: true }).click()
  const tile = sidebar.locator('[data-encounter-uid="wolf"] .session-roster-tile')
  const checkbox = tile.getByRole('checkbox', { name: 'Выбрать: Волк', exact: true })
  await expect(tile).toHaveClass(/session-roster-tile--current/)
  await checkbox.click()
  await page.mouse.move(0, 0)
  const brush = () => tile.evaluate(node => getComputedStyle(node, '::after').opacity)
  await expect.poll(brush).toBe('0.34')

  const motion = await tile.evaluate(async node => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const swords = node.querySelector('.roster-stage-backdrop svg')
    const sample = () => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = getComputedStyle(node, '::before').backgroundColor
      context.fillRect(0, 0, 1, 1)
      const tint = [...context.getImageData(0, 0, 1, 1).data]
      return { tint, brush: Number(getComputedStyle(node, '::after').opacity), swords: Number(getComputedStyle(swords).opacity) }
    }
    const before = sample()
    node.querySelector('[role="checkbox"]').click()
    const frames = []
    const deadline = performance.now() + 320
    do {
      await new Promise(requestAnimationFrame)
      frames.push(sample())
    } while (performance.now() < deadline)
    return { before, frames, after: frames.at(-1) }
  })

  const { before, frames, after } = motion
  expect(before.tint[3] / 255).toBeCloseTo(.13, 2)
  expect(after.tint[3] / 255).toBeCloseTo(.05, 2)
  expect([before.brush, before.swords]).toEqual([.34, .28])
  expect([after.brush, after.swords]).toEqual([0, .16])
  const progress = (start, value, end) => (start - value) / (start - end)
  const intermediate = frames.filter(frame => frame.brush > .04 && frame.brush < .30)
  expect(intermediate.length).toBeGreaterThan(0)
  for (const frame of intermediate) {
    const brushProgress = progress(before.brush, frame.brush, after.brush)
    const swordProgress = progress(before.swords, frame.swords, after.swords)
    const tintProgress = progress(before.tint[3], frame.tint[3], after.tint[3])
    expect(Math.abs(brushProgress - swordProgress)).toBeLessThan(.02)
    expect(Math.abs(brushProgress - tintProgress)).toBeLessThan(.10)
  }
  await expect(checkbox).not.toBeChecked()
  await expect(tile.locator('.roster-presence')).toBeVisible()
  await info.attach('deselect-frames', { body: Buffer.from(JSON.stringify(motion)), contentType: 'application/json' })
  await info.attach('deselect-current-932', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await checkbox.press('Space')
  expect(await brush()).toBe('0.34')
  await checkbox.press('Space')
  expect(await brush()).toBe('0')
  await expect(tile).toHaveClass(/session-roster-tile--current/)
})

test('selection captions and the following controls stay level as the selection changes', async ({ page }, info) => {
  const api = await rosterSelectionFixture(page, 932)
  const wolf = api.encounter().combatants.find(row => row.uid === 'wolf')
  api.encounter().combatants.push({ ...structuredClone(wolf), uid: 'wolf-copy', markerLetter: 'B' })
  await page.setViewportSize({ width: 932, height: 704 })
  await page.reload()
  await page.getByRole('button', { name: /Открыть бой/ }).click()
  const sidebar = page.locator('aside.map-sidebar')
  await sidebar.getByRole('navigation').getByRole('button', { name: 'Запас', exact: true }).click()
  await expect(sidebar).not.toHaveClass(/map-sidebar--opening/)
  const left = sidebar.locator('.session-sidebar-header-controls')
  const right = page.locator('.enc-secondary .roster-selection')
  const summary = root => root.getByRole('group', { name: 'Выбрано по видам', exact: true })
  const controls = [left, right]
  const geometry = root => summary(root).evaluate(node => {
    const bounds = node.getBoundingClientRect()
    const text = document.createRange()
    text.selectNodeContents(node.firstElementChild)
    return {
      labelTop: text.getBoundingClientRect().top - bounds.top,
      reserveHeight: bounds.height,
      nextRowTop: node.nextElementSibling.getBoundingClientRect().top - bounds.top,
    }
  })
  for (const root of controls) await expect(summary(root)).toHaveText('Никто не выбран')
  const empty = await Promise.all(controls.map(geometry))
  await info.attach('selection-empty-932', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
  const checkbox = uid => sidebar.locator(`[data-encounter-uid="${uid}"]`).getByRole('checkbox')
  await checkbox('wolf').click()
  for (const root of controls) await expect(summary(root).getByRole('img', { name: 'Волк', exact: true })).toHaveCount(1)
  expect(await Promise.all(controls.map(geometry))).toEqual(empty)
  await checkbox('wolf-copy').click()
  for (const root of controls) await expect(summary(root).getByRole('img', { name: 'Волк: 2', exact: true })).toHaveCount(1)
  expect(await Promise.all(controls.map(geometry))).toEqual(empty)
  await info.attach('selection-grouped-932', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
  await left.getByRole('button', { name: 'Сбросить выбор', exact: true }).click()
  for (const root of controls) await expect(summary(root)).toHaveText('Никто не выбран')
  expect(await Promise.all(controls.map(geometry))).toEqual(empty)
})

test('sidebar tab motion preserves one mounted panel and respects reduced motion',async({page})=>{
  const api=await rosterSelectionFixture(page,834)
  api.encounter().reserveTabs=[{id:'watch',name:'Дозор'}]
  await page.reload()
  const sidebar=page.locator('aside.map-sidebar')
  const nav=sidebar.getByRole('navigation')
  await nav.getByRole('button',{name:'Игроки',exact:true}).click()
  await expect(sidebar).not.toHaveClass(/map-sidebar--opening/)
  const panel=sidebar.locator('.map-sidebar-viewport > .map-sidebar-content')
  const mountedPanel=await panel.elementHandle()
  async function switchTab(name){
    return nav.getByRole('button',{name,exact:true}).evaluate(async button=>{
      button.click()
      await new Promise(requestAnimationFrame)
      const content=button.closest('aside').querySelector('.map-sidebar-viewport > .map-sidebar-content')
      return content.getAnimations().some(animation=>animation.playState==='running')
    })
  }
  expect(await switchTab('Запас')).toBe(true)
  await expect(panel).toHaveAttribute('data-tab','reserves:default')
  expect(await switchTab('Дозор')).toBe(true)
  await expect(panel).toHaveAttribute('data-tab','reserves:watch')
  expect(await mountedPanel.evaluate(node=>node.isConnected)).toBe(true)
  await page.emulateMedia({reducedMotion:'reduce'})
  expect(await switchTab('Игроки')).toBe(false)
  await expect(panel).toHaveAttribute('data-tab','players')
})

for(const width of [390,834,1440])test(`combat selection icons and stage watermark at ${width}`,async({page},info)=>{
  const api=await rosterSelectionFixture(page,width)
  const wolf=api.encounter().combatants.find(row=>row.uid==='wolf')
  wolf.itemId=700
  api.encounter().combatants.push({...structuredClone(wolf),uid:'wolf2'})
  await page.reload()
  const sidebar=page.locator('aside.map-sidebar'),nav=sidebar.getByRole('navigation'),toolbar=sidebar.locator('.session-sidebar-header-controls')
  await nav.getByRole('button',{name:'Запас',exact:true}).click()
  const first=sidebar.locator('[data-encounter-uid="wolf"]'),second=sidebar.locator('[data-encounter-uid="wolf2"]')
  const summary=toolbar.locator('.roster-selection-summary')
  await expect(summary).toHaveText('Никто не выбран')
  const emptyHeight=(await summary.boundingBox()).height
  await first.getByRole('checkbox').click();await second.getByRole('checkbox').click()
  await expect(summary.getByRole('img',{name:'Волк: 2',exact:true})).toBeVisible()
  expect((await summary.boundingBox()).height).toBe(emptyHeight)
  await page.locator('.chapter-toolbar').getByRole('button',{name:'Хроника',exact:true}).click()
  await expect(summary.getByRole('img',{name:'Волк: 2',exact:true})).toBeVisible()
  await page.getByRole('button',{name:/Открыть бой/}).click()
  await expect(summary.getByRole('img',{name:'Волк: 2',exact:true})).toBeVisible()
  await expect(summary.locator('.selection-summary-item')).toHaveCount(1)
  await expect(summary.locator('.selection-summary-quantity')).toHaveText('2')
  await toolbar.getByRole('button',{name:'Добавить на сцену: 2',exact:true}).click()
  await expect(first.locator('.roster-stage-backdrop')).toHaveAccessibleName('На сцене')
  await expect(first.locator('.roster-presence')).toBeHidden()
  await expect(first.locator('.roster-stage-backdrop svg')).toHaveCSS('opacity','0.28')
  const geometry=await first.locator('.session-roster-tile').evaluate(node=>({under:getComputedStyle(node.querySelector('.roster-stage-backdrop')).zIndex,paint:getComputedStyle(node,'::before').zIndex,underClip:getComputedStyle(node.querySelector('.roster-stage-backdrop')).clipPath,paintClip:getComputedStyle(node,'::before').clipPath}))
  expect(+geometry.under).toBeLessThan(+geometry.paint)
  expect(geometry.underClip).toBe(geometry.paintClip)
  await second.getByRole('checkbox').click()
  await expect(second.locator('.roster-stage-backdrop svg')).toHaveCSS('opacity','0.16')
  await expect(summary.getByRole('img',{name:'Волк',exact:true})).toBeVisible()
  await expect(summary.locator('.selection-summary-quantity')).toHaveCount(0)
  await expect(summary.locator('.selection-summary-portrait')).toHaveCSS('background-color','rgba(0, 0, 0, 0)')
  await info.attach(`stage-background-${width}`,{body:await sidebar.screenshot({animations:'disabled'}),contentType:'image/png'})
  await expect.poll(()=>api.encounter().combatants.filter(c=>c.position==='combat').length).toBe(2)
  expect(api.errors).toEqual([]);expect(api.warnings).toEqual([])
})

for(const width of [390,834,1440]) test(`selection stacks below the actions and fits the sidebar at ${width}`,async({page},info)=>{
  const api=await rosterSelectionFixture(page,width)
  for(let i=2;i<9;i++){
    api.participants.push({...structuredClone(api.participants[0]),charId:i+1,charUuid:`player-${i}`,data:{values:{...structuredClone(api.participants[0].data.values),name:`Герой ${i}`}}})
    api.encounter().combatants.push({uid:`p-${i+1}`,type:'player',charId:i+1,position:'reserve'})
  }
  await page.reload()
  const sidebar=page.locator('aside.map-sidebar'),nav=sidebar.getByRole('navigation')
  if((await sidebar.getAttribute('class')).includes('map-sidebar--collapsed'))await nav.getByRole('button',{name:'Игроки',exact:true}).click()
  await page.getByRole('button',{name:/Открыть бой/}).click()
  const toolbar=sidebar.locator('.session-sidebar-header-controls')
  const selectAll=toolbar.getByRole('checkbox',{name:'Выбрать всех в этой вкладке',exact:true})
  await selectAll.click()
  const summary=toolbar.locator('.roster-selection-summary')
  await expect(summary.locator('.selection-summary-item')).toHaveCount(9)
  const actions=await toolbar.getByRole('group',{name:'Действия с выбранными'}).boundingBox()
  const checkbox=await selectAll.boundingBox()
  const summaryBox=await summary.boundingBox()
  expect(summaryBox.y).toBeGreaterThanOrEqual(actions.y+actions.height)
  expect(checkbox.y).toBeGreaterThanOrEqual(summaryBox.y+summaryBox.height-1)
  const geometry=await summary.evaluate(node=>{
    const rect=element=>element.getBoundingClientRect()
    return {
      bounds:rect(node).toJSON(),
      portraits:[...node.querySelectorAll('.selection-summary-portrait')].map(rect).map(r=>r.toJSON()),
    }
  })
  expect(new Set(geometry.portraits.map(rect=>rect.top)).size).toBe(1)
  expect(geometry.portraits[1].left).toBeLessThan(geometry.portraits[0].right)
  expect(geometry.portraits.at(-1).right).toBeLessThanOrEqual(geometry.bounds.right)
  await expect(summary.locator('.selection-summary-quantity')).toHaveCount(0)
  await expect(summary.getByRole('img',{name:'Лира',exact:true})).toBeVisible()
  await expect(toolbar.getByRole('button',{name:'Сбросить выбор',exact:true})).toBeVisible()
  await info.attach(`selection-stack-${width}`,{body:await sidebar.screenshot({animations:'disabled'}),contentType:'image/png'})
  if(width===390){
    await page.setViewportSize({width:300,height:980})
    if((await sidebar.getAttribute('class')).includes('map-sidebar--collapsed'))await nav.getByRole('button',{name:'Игроки',exact:true}).click()
    await expect.poll(()=>summary.evaluate(node=>{
      const bounds=node.getBoundingClientRect()
      const portraits=[...node.querySelectorAll('.selection-summary-portrait')].map(element=>element.getBoundingClientRect())
      return portraits.length===9 && new Set(portraits.map(rect=>rect.top)).size>1 && portraits.every(rect=>rect.right<=bounds.right)
    })).toBe(true)
  }
  await toolbar.getByRole('button',{name:'Сбросить выбор',exact:true}).click()
  await expect(summary).toHaveText('Никто не выбран')
  expect(api.errors).toEqual([]);expect(api.warnings).toEqual([])
})
