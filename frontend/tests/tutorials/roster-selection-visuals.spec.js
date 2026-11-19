import { expect,test } from '@playwright/test'
import { openRosterActions, rosterSelectionFixture } from './fixtures/session-roster.js'

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
  await expect(tile).toHaveAttribute('aria-current', 'true')
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
  const geometry = root => summary(root).evaluate(node => {
    const bounds = node.getBoundingClientRect()
    const text = document.createRange()
    text.selectNodeContents(node.firstElementChild)
    return {
      labelTop: text.getBoundingClientRect().top - bounds.top,
      reserveHeight: bounds.height,
      nextRowTop: node.parentElement.nextElementSibling.getBoundingClientRect().top - bounds.top,
    }
  })
  await expect(summary(left)).toHaveText('Никто не выбран')
  await expect(right).toHaveCount(0)
  const empty = await geometry(left)
  await info.attach('selection-empty-932', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
  const checkbox = uid => sidebar.locator(`[data-encounter-uid="${uid}"]`).getByRole('checkbox')
  await checkbox('wolf').click()
  await expect(summary(left).getByRole('img', { name: 'Волк', exact: true })).toHaveCount(1)
  expect(await geometry(left)).toEqual(empty)
  await checkbox('wolf-copy').click()
  await expect(summary(left).getByRole('img', { name: 'Волк: 2', exact: true })).toHaveCount(1)
  expect(await geometry(left)).toEqual(empty)
  await info.attach('selection-grouped-932', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
  await left.getByRole('button', { name: 'Сбросить выбор', exact: true }).click()
  await expect(summary(left)).toHaveText('Никто не выбран')
  expect(await geometry(left)).toEqual(empty)
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
  const menu = await openRosterActions(page, toolbar)
  const damage = menu.getByRole('menuitem', { name: 'Нанести урон: 2', exact: true })
  await expect(damage.locator('.selection-summary-item')).toHaveCount(1)
  await expect(damage.locator('.selection-summary-quantity')).toHaveText('2')
  await expect(damage.locator('.selection-summary-portrait')).toHaveCSS('width', '32px')
  await menu.getByRole('menuitem',{name:'Добавить на сцену: 2',exact:true}).click()
  await expect(first.locator('.roster-stage-backdrop')).toHaveAccessibleName('На сцене')
  await expect(first.locator('.session-roster-tile[aria-current="true"]')).toHaveCount(0)
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

for(const width of [390,834,1440]) test(`selection stacks beside reset and keeps actions below at ${width}`,async({page},info)=>{
  const api=await rosterSelectionFixture(page,width)
  const groupCount = 32
  for(let i=2;i<groupCount;i++){
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
  await expect(summary.locator('.selection-summary-item')).toHaveCount(groupCount)
  const actions=await toolbar.getByRole('button',{name:'Действия',exact:true}).boundingBox()
  const reset=await toolbar.getByRole('button',{name:'Сбросить выбор',exact:true}).boundingBox()
  const checkbox=await selectAll.boundingBox()
  const summaryBox=await summary.boundingBox()
  expect(reset.x).toBeGreaterThanOrEqual(summaryBox.x+summaryBox.width)
  expect(reset.y).toBeCloseTo(summaryBox.y, 0)
  expect(actions.x+actions.width).toBeCloseTo(reset.x+reset.width, 0)
  expect(actions.y).toBeGreaterThanOrEqual(summaryBox.y+summaryBox.height)
  expect(checkbox.y+checkbox.height/2).toBeCloseTo(actions.y+actions.height/2, 0)
  const measure = () => summary.evaluate(node => {
    const items = [...node.querySelectorAll('.selection-summary-item')]
    const portraits = items.map(item => item.querySelector('.selection-summary-portrait').getBoundingClientRect())
    const { left, top, right, bottom } = portraits.at(-1)
    const hits = document.elementsFromPoint((left + right) / 2, (top + bottom) / 2)
    const topItem = hits.map(element => element.closest('.selection-summary-item')).find(Boolean)
    return {
      bounds: node.getBoundingClientRect().toJSON(),
      portraits: portraits.map(rect => rect.toJSON()),
      topIndex: items.indexOf(topItem),
    }
  })
  function expectSingleRow({ bounds, portraits, topIndex }) {
    expect(portraits).toHaveLength(groupCount)
    expect(new Set(portraits.map(rect => rect.top)).size).toBe(1)
    expect(portraits.every(rect => rect.left >= bounds.left && rect.right <= bounds.right)).toBe(true)
    expect(portraits.slice(1).every((rect, i) => rect.left >= portraits[i].left && rect.left < portraits[i].right)).toBe(true)
    expect(topIndex).toBe(groupCount - 1)
    return portraits.at(-1).left - portraits[0].left
  }
  const spread = expectSingleRow(await measure())
  await expect(summary.locator('.selection-summary-quantity')).toHaveCount(0)
  await expect(summary.getByRole('img',{name:'Лира',exact:true})).toBeVisible()
  await expect(toolbar.getByRole('button',{name:'Сбросить выбор',exact:true})).toBeVisible()
  await info.attach(`selection-stack-${width}`,{body:await sidebar.screenshot({animations:'disabled'}),contentType:'image/png'})
  if(width===390){
    await page.setViewportSize({width:300,height:980})
    if((await sidebar.getAttribute('class')).includes('map-sidebar--collapsed'))await nav.getByRole('button',{name:'Игроки',exact:true}).click()
    await expect(sidebar).not.toHaveClass(/map-sidebar--opening/)
    expect(expectSingleRow(await measure())).toBeLessThan(spread)
  }
  await toolbar.getByRole('button',{name:'Сбросить выбор',exact:true}).click()
  await expect(summary).toHaveText('Никто не выбран')
  expect(api.errors).toEqual([]);expect(api.warnings).toEqual([])
})

test('closing the sidebar keeps its header in place until the combat footer can open', async ({ page }) => {
  await rosterSelectionFixture(page, 932)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: /Открыть бой/ }).click()
  const sidebar = page.locator('aside.map-sidebar')
  await sidebar.getByRole('navigation').getByRole('button', { name: 'Запас', exact: true }).click()
  await expect(sidebar).not.toHaveClass(/map-sidebar--opening/)
  const motion = await page.evaluate(async () => {
    const sidebar = document.querySelector('aside.map-sidebar')
    const header = sidebar.querySelector('.map-sidebar-header')
    const panel = document.querySelector('.combat-selection-panel')
    const animations = sidebar.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime))
    await Promise.allSettled(animations.map(animation => animation.finished))
    const sample = () => ({
      width: sidebar.getBoundingClientRect().width,
      header: header.getBoundingClientRect().height,
      left: !!header.querySelector('.roster-selection'),
      height: panel.getBoundingClientRect().height,
      alpha: Number(getComputedStyle(panel).opacity),
    })
    const before = sample()
    header.querySelector('button[aria-label="Свернуть боковую панель"]').click()
    const frames = []
    const until = performance.now() + 850
    do {
      await new Promise(requestAnimationFrame)
      frames.push(sample())
    } while (performance.now() < until)
    return { before, frames, after: frames.at(-1) }
  })
  expect(motion.before.height).toBe(0)
  expect(motion.before.left).toBe(true)
  const closing = motion.frames.filter(frame => frame.width > motion.after.width + 1 && frame.width < motion.before.width - 1)
  expect(closing.length).toBeGreaterThan(0)
  expect(closing.every(frame => frame.left && Math.abs(frame.header - motion.before.header) < .05)).toBe(true)
  expect(motion.after.left).toBe(false)
  expect(motion.after.height).toBeGreaterThan(0)
  expect(motion.frames.some(frame => frame.height > 0 && frame.height < motion.after.height && frame.alpha > 0 && frame.alpha < 1)).toBe(true)
  const phase = page.locator('.enc-secondary .enc-control-panel')
  const footer = phase.locator('.combat-selection-footer')
  await expect(footer.locator('.roster-selection')).toBeVisible()
  await expect(footer).toHaveCSS('border-top-width', '1px')
  const summary = await footer.getByRole('group', { name: 'Выбрано по видам' }).boundingBox()
  for (const name of ['Сбросить выбор', 'Действия']) {
    const button = await footer.getByRole('button', { name, exact: true }).boundingBox()
    expect(button.y).toBeCloseTo(summary.y, 0)
    expect(button.x).toBeGreaterThanOrEqual(summary.x+summary.width)
  }
})
