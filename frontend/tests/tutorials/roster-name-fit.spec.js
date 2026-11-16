import { test,expect } from '@playwright/test'
import { rosterSelectionFixture } from './fixtures/session-roster.js'

async function fits(text, wrapper) {
  await expect.poll(async()=>{
    const a=await text.boundingBox(),b=await wrapper.boundingBox()
    return !!a&&!!b&&a.width<=b.width+.5
  }).toBe(true)
  await expect(wrapper).not.toHaveCSS('text-overflow','ellipsis')
}

async function markerOnAvatar(marker,avatar) {
  await expect(marker).toBeVisible()
  const {a,m}=await marker.evaluate((node,avatarNode)=>({a:avatarNode.getBoundingClientRect().toJSON(),m:node.getBoundingClientRect().toJSON()}),await avatar.elementHandle())
  expect(m.x+m.width).toBeCloseTo(a.x+a.width,0)
  expect(m.y).toBeCloseTo(a.y,0)
  expect(m.x).toBeGreaterThanOrEqual(a.x)
  const glyph=marker.locator('.npc-marker')
  const letter=await glyph.count()?glyph:marker
  await expect(letter).not.toHaveCSS('text-shadow','none')
  await expect(letter).not.toHaveCSS('background-color','rgba(0, 0, 0, 0)')
  await expect(letter).toHaveCSS('border-radius','5px')
}

for(const width of [390,834,1440])test(`full player and NPC names fit dynamically with avatar markers at ${width}`,async({page},info)=>{
  page.on('pageerror',error=>{throw error})
  await page.setViewportSize({width,height:980})
  await page.goto('/tests/tutorials/fixtures/participant-controls.html')
  await page.addStyleTag({content:'body{margin:0;background:var(--bg)}'})
  await page.evaluate(()=>{document.querySelector('.enc-combat-primary').style.width='264px';window.controls.state.combat=false})
  const player=page.locator('.p-card'),npc=page.locator('.enc-row')
  const pText=player.locator('.identity-name-text'),pWrapper=player.locator('.identity strong')
  const nText=npc.locator('.identity-name-text'),nWrapper=npc.locator('.identity strong')
  const base=await player.evaluate(n=>parseFloat(getComputedStyle(n).getPropertyValue('--type-participant-name-size')))
  await page.evaluate(()=>document.fonts.ready)
  await expect(pText).toHaveCSS('font-size',`${base}px`)
  await expect(pText).toHaveCSS('font-weight','500')
  await markerOnAvatar(npc.locator('.enc-marker'),npc.locator('.portrait'))
  expect(await npc.locator('.enc-marker').evaluate(n=>!!n.parentElement.closest('button'))).toBe(false)
  await expect(npc.locator('.identity .enc-marker')).toHaveCount(0)
  const pName='Элеонора Хранительница серебряного перевала',nName='Древний хранитель забытого подземелья северных земель'
  await page.evaluate(({pName,nName})=>{window.controls.participant.data.values.name=pName;window.controls.encounter.npcName=()=>nName},{pName,nName})
  await expect(pText).toHaveText(pName);await expect(nText).toHaveText(nName)
  for(const [text,wrapper] of [[pText,pWrapper],[nText,nWrapper]]) {
    await expect.poll(()=>text.evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBeLessThan(base)
    await fits(text,wrapper)
  }
  await page.evaluate(()=>{window.controls.player.initiative=123;window.controls.npc.initiative=123})
  await expect(player.getByLabel('Подготовленная инициатива: 123')).toBeVisible()
  await expect(npc.getByLabel('Инициатива: 123')).toBeVisible()
  await fits(pText,pWrapper);await fits(nText,nWrapper)
  const oldSize=await pText.evaluate(n=>parseFloat(getComputedStyle(n).fontSize))
  await page.locator('.participant-test-column').evaluate(n=>{n.style.width='210px'})
  await expect.poll(()=>pText.evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBeLessThan(oldSize)
  await fits(pText,pWrapper)
  await info.attach(`fitted-names-${width}`,{body:await page.screenshot(),contentType:'image/png'})
  await page.evaluate(()=>{window.controls.state.npcSection='combat'})
  const combatText=npc.locator('.identity-name-text'),combatWrapper=npc.locator('.identity strong')
  await fits(combatText,combatWrapper)
  await markerOnAvatar(npc.locator('.enc-marker'),npc.locator('.enc-avatar'))
  await expect(npc.locator('.identity .enc-marker')).toHaveCount(0)
  await page.evaluate(()=>{window.controls.participant.data.values.name='Тиф';window.controls.encounter.npcName=()=>'Огр';window.controls.player.initiative=null;window.controls.npc.initiative=null})
  await expect(pText).toHaveText('Тиф');await expect(combatText).toHaveText('Огр')
  await expect.poll(()=>pText.evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBe(base)
  await expect.poll(()=>combatText.evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBe(base)
})

test('avatar marker remains editable and is shared with combat and turn preview',async({page})=>{
  const api=await rosterSelectionFixture(page,1440)
  const sidebar=page.locator('aside.map-sidebar'),nav=page.getByRole('navigation',{name:'Боковые вкладки сессии'})
  await nav.getByRole('button',{name:'Запас',exact:true}).click()
  const reserve=sidebar.getByRole('region',{name:'Запас существ',exact:true})
  await reserve.getByRole('button',{name:'Метка существа A',exact:true}).click()
  await expect(page.getByText('Буква существа',{exact:true})).toBeVisible()
  await page.locator('.emm-grid').getByRole('button',{name:'C',exact:true}).click()
  await expect(reserve.getByRole('button',{name:'Метка существа C',exact:true})).toBeVisible()
  await expect.poll(()=>api.encounter().combatants.find(row=>row.uid==='wolf').markerLetter).toBe('C')
  await page.getByRole('button',{name:/Открыть бой/}).click()
  await sidebar.getByRole('button',{name:/Режим выбора/}).click()
  await reserve.getByRole('checkbox',{name:'Выбрать: Волк',exact:true}).click()
  await sidebar.getByRole('button',{name:'Переместить в бой',exact:true}).click()
  await page.getByRole('button',{name:'Начать бой',exact:true}).click()
  const preview=page.getByRole('complementary',{name:'Текущий ход'})
  await expect(preview).toBeVisible()
  await markerOnAvatar(preview.locator('.turn-preview-avatar-marker'),preview.locator('.enc-avatar'))
  await expect(preview.locator('.turn-preview-name .npc-marker')).toHaveCount(0)
  expect(api.errors).toEqual([]);expect(api.warnings).toEqual([])
})
