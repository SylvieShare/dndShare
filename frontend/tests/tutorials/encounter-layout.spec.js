import {test,expect} from '@playwright/test'
import {sessionLayout} from './fixtures/session-layout.js'
import {encounterColumnsMinWidth} from '../../src/features/sessions/lib/encounterLayout.js'
import {spacingTokens} from '../../src/app/design-tokens.js'

for (const width of [390, 932, 1440]) test(`passing the turn keeps every row in place at ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 844 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const api = await sessionLayout(page, {
    url: '/sessions/test',
    participants: [{ charId: 1, charUuid: 'hero', templateId: 1, data: { values: { name: 'Лира', hp: { current: 18, max: { base: 24 } } } } }],
    encounter: { active: true, round: 1, turnIndex: 0, combatants: [
      { uid: 'p-1', type: 'player', charId: 1, charUuid: 'hero', initiative: 18, position: 'combat' },
      { uid: 'wolf', type: 'npc', override: { name: 'Волк', hp: 12, ac: 13 }, hpCurrent: 12, markerLetter: 'A', initiative: 12, position: 'combat' },
      { uid: 'orc', type: 'npc', override: { name: 'Орк', hp: 16, ac: 12 }, hpCurrent: 16, markerLetter: 'B', initiative: 8, position: 'combat' },
    ] },
  })
  await page.getByRole('button', { name: /Открыть бой/ }).click()
  const root = page.locator('.enc-wrap--workspace')
  const active = root.locator('.roster-presence-slot[aria-hidden="false"]')
  await expect(active).toHaveCount(1)
  await expect(root.locator('.enc-row--current')).toContainText('Лира')
  await page.mouse.move(0, 0)
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise(requestAnimationFrame)
    const animations = document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime))
    await Promise.allSettled(animations.map(animation => animation.finished))
  })
  const motion = await root.evaluate(async element => {
    const tiles = [...element.querySelectorAll('.session-roster-tile')]
    const frame = () => new Promise(requestAnimationFrame)
    const next = element.querySelector('button[aria-label="Следующий ход"]')
    const previous = element.querySelector('button[aria-label="Предыдущий ход"]')
    const sample = () => tiles.map(tile => {
      const label = tile.querySelector('.roster-presence-slot')
      const paint = getComputedStyle(tile, '::before')
      const bounds = tile.getBoundingClientRect()
      return {
        top: bounds.top,
        height: bounds.height,
        labelOpacity: Number(getComputedStyle(label).opacity),
        highlight: Number(paint.opacity),
        color: paint.backgroundColor,
      }
    })
    const before = sample()
    next.click()
    const samples = []
    const deadline = performance.now() + 320
    do {
      await frame()
      samples.push(sample())
    } while (performance.now() < deadline)
    const after = samples.at(-1)
    previous.click()
    await frame()
    await frame()
    const reversing = sample()
    next.click()
    await frame()
    await frame()
    return { before, samples, after, reversing, retargeted: sample() }
  })
  expect(motion.before.map(tile => tile.labelOpacity)).toEqual([1, 0, 0])
  expect(motion.after.map(tile => tile.labelOpacity)).toEqual([0, 1, 0])
  const geometry = tiles => tiles.map(({ top, height }) => ({ top: +top.toFixed(2), height: +height.toFixed(2) }))
  for (const sample of [...motion.samples, motion.reversing, motion.retargeted]) {
    expect(geometry(sample)).toEqual(geometry(motion.before))
  }
  for (const [index, start] of motion.before.slice(0, 2).entries()) {
    const end = motion.after[index]
    for (const property of ['labelOpacity', 'highlight']) {
      const min = Math.min(start[property], end[property]), max = Math.max(start[property], end[property])
      expect(motion.samples.some(sample => sample[index][property] > min && sample[index][property] < max)).toBe(true)
    }
    expect(motion.samples.some(sample => sample[index].color !== start.color && sample[index].color !== end.color)).toBe(true)
  }
  await expect.poll(() => api.encounter().turnIndex).toBe(1)
  await expect(root.locator('.enc-row--current')).toContainText('Волк')
  await expect(root.locator('[data-encounter-uid="p-1"] .roster-presence')).toBeHidden()
  await expect(active).toHaveCount(1)
  await info.attach('turn-motion-frames', { body: Buffer.from(JSON.stringify(motion)), contentType: 'application/json' })
  await info.attach(`turn-motion-final-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const immediate = await root.evaluate(async element => {
    element.querySelector('button[aria-label="Предыдущий ход"]').click()
    await new Promise(requestAnimationFrame)
    return [...element.querySelectorAll('.session-roster-tile')].map(tile => ({
      top: tile.getBoundingClientRect().top,
      height: tile.getBoundingClientRect().height,
      labelOpacity: Number(getComputedStyle(tile.querySelector('.roster-presence-slot')).opacity),
      highlight: Number(getComputedStyle(tile, '::before').opacity),
    }))
  })
  expect(geometry(immediate)).toEqual(geometry(motion.before))
  for (const [index, tile] of immediate.entries()) {
    expect(tile.labelOpacity).toBe(motion.before[index].labelOpacity)
    expect(tile.highlight).toBe(motion.before[index].highlight)
  }
  await expect.poll(() => api.encounter().turnIndex).toBe(0)
  await expect(root.locator('.enc-row--current')).toContainText('Лира')
})

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
  const actions = controls.getByRole('group', { name: 'Действия с выбранными участниками' })
  await expect(actions.getByRole('button', { name: 'Бои сценария', exact: true })).toBeVisible()
  await expect(actions.getByRole('button', { name: 'Отметить выбранных погибшими' })).toBeVisible()
  await expect(actions.getByRole('button', { name: 'Убрать со сцены: 0', exact: true })).toBeDisabled()
  await expect(controls.locator('.enc-control-panel')).toHaveCount(2)
  await expect(roster.locator('.enc-icon-btn,.enc-section-icon-btn')).toHaveCount(0)
  await controls.getByRole('button',{name:'Следующий ход',exact:true}).click()
  await expect(root.locator('.enc-row--current')).toContainText('Орк')
  const roughRow = root.locator('.enc-row--current')
  await expect(roughRow.locator('..')).toHaveClass(/enc-row-tile--rough-edges/)
  expect(await roughRow.evaluate(row => getComputedStyle(row, '::before').clipPath)).toMatch(/polygon\(.+calc\(100% - /)
  for(const width of [390,704,834,1440,704]) {
    await page.setViewportSize({width,height:932})
    const columns=await root.evaluate((n,min)=>n.offsetWidth>=min,encounterColumnsMinWidth+2*spacingTokens.page)
    expect(columns).toBe(width>=834)
    await expect(preview).toHaveCount(0)
    for (const name of ['Убрать со сцены: 0', 'Бои сценария', 'Отметить выбранных погибшими', 'Удалить выбранных НПС']) {
      const caption = actions.getByRole('button', { name, exact: true }).locator('.enc-control-label')
      const lines = await caption.evaluate(label => {
        const range = document.createRange()
        range.selectNodeContents(label)
        return new Set([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => rect.top)).size
      })
      expect(lines).toBe(2)
    }
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
    await root.evaluate(n=>{n.scrollTop=0})
    await info.attach(`combat-columns-${width}`,{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'})
  }
  await page.setViewportSize({width:1440,height:932})
  await expect(root).toHaveClass(/enc-wrap--columns/)
  await roster.locator('.enc-combat-primary').evaluate(n=>{const extra=document.createElement('div');extra.style.height='3000px';n.append(extra)})
  await controls.evaluate(n=>{const extra=document.createElement('div');extra.style.height='3000px';extra.style.flex='none';n.append(extra)})
  await roster.evaluate(n=>{n.scrollTop=500})
  expect(await controls.evaluate(n=>n.scrollTop)).toBe(0)
  await controls.evaluate(n=>{n.scrollTop=200})
  expect(await controls.evaluate(n=>n.scrollTop)).toBe(200)
  expect(await roster.evaluate(n=>n.scrollTop)).toBe(500)
  expect(await page.evaluate(()=>document.documentElement.scrollTop)).toBe(0)
  await controls.getByRole('button',{name:'Следующий ход',exact:true}).click()
  await expect.poll(()=>api.encounter().round).toBe(2)
  expect(encounterColumnsMinWidth).toBe(628)
})

test.describe('compact combat on a touch screen', () => {
  test.use({ hasTouch: true })

  test('commands and scene share one scroll in preparation and active combat', async ({ page }, info) => {
    const combatants = Array.from({ length: 14 }, (_, index) => ({
      uid: `npc-${index + 1}`, type: 'npc', position: 'combat', initiative: 20 - index,
      override: { name: `Участник ${index + 1}`, hp: 12, ac: 13 }, hpCurrent: 12,
      markerLetter: String.fromCharCode(65 + index),
    }))
    await page.setViewportSize({ width: 704, height: 932 })
    const api = await sessionLayout(page, { url: '/sessions/test', participants: [], encounter: { active: false, round: 0, turnIndex: 0, combatants } })
    await page.getByRole('button', { name: /Открыть бой/ }).click()
    const root = page.locator('.enc-wrap--workspace')
    const roster = root.locator('.enc-content')
    const controls = root.locator('.enc-secondary')
    const start = controls.getByRole('button', { name: 'Начать бой', exact: true })
    const last = roster.locator('[data-encounter-uid="npc-14"]').first()
    await expect(start).toBeInViewport({ ratio: 1 })
    await expect(root).not.toHaveClass(/enc-wrap--columns/)
    await expect(roster.locator('.enc-row-shell')).toHaveCount(combatants.length)
    await expect(roster.locator('.enc-row-order > span')).toHaveText(combatants.map((_, index) => String(index + 1)))
    const controlsTop = (await controls.boundingBox()).y
    const initial = await controls.boundingBox()
    const touch = await page.context().newCDPSession(page)
    try {
      const x = initial.x + 12
      const y = initial.y + initial.height - 30
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      for (let distance = 24; distance <= 168; distance += 24) {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - distance }] })
      }
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    } finally {
      await touch.detach()
    }
    await expect.poll(() => root.evaluate(node => node.scrollTop)).toBeGreaterThan(30)
    await expect.poll(async () => (await controls.boundingBox()).y).toBeLessThan(controlsTop - 30)
    expect(await controls.evaluate(node => node.scrollTop)).toBe(0)

    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport({ ratio: 1 })
    await expect(start).not.toBeInViewport()
    expect(await roster.evaluate(node => node.scrollTop)).toBe(0)
    expect(api.writes).toHaveLength(0)
    await info.attach('combat-shared-scroll-tablet', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })

    await root.evaluate(node => { node.scrollTop = 0 })
    await expect(start).toBeInViewport({ ratio: 1 })
    await start.click()
    await expect.poll(() => api.encounter().active).toBe(true)
    await expect(roster.locator('.enc-row--current')).toContainText('Участник 1')
    await page.setViewportSize({ width: 390, height: 844 })
    const next = controls.getByRole('button', { name: 'Следующий ход', exact: true })
    await expect(next).toBeInViewport({ ratio: 1 })
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport({ ratio: 1 })
    await expect(next).not.toBeInViewport()
    expect(await controls.evaluate(node => node.scrollTop)).toBe(0)
    expect(await roster.evaluate(node => node.scrollTop)).toBe(0)
    await root.evaluate(node => { node.scrollTop = 0 })
    await next.click()
    await expect(roster.locator('.enc-row--current')).toContainText('Участник 2')
  })
})
