import { test,expect } from '@playwright/test'
import { sessionLayout } from './fixtures/session-layout.js'

const trackName='Длинное название проверочного музыкального трека'
async function open(page,width) {
  page.on('pageerror',error=>{throw error})
  await page.setViewportSize({width,height:932})
  await sessionLayout(page,{url:'/sessions/test',participants:[],music:{
    tracks:[{id:1,name:trackName,durationSec:120,albumIds:[],tags:[]},{id:2,name:'Следующий трек',durationSec:90,albumIds:[],tags:[]}],
    state:{trackId:1,nextTrackId:2,playing:false,positionSec:30},
  }})
  const header=page.locator('.chapter-toolbar'),tools=header.getByRole('group',{name:'Инструменты сессии',exact:true})
  await expect(tools.getByRole('button')).toHaveCount(4)
  await expect(header.getByRole('button',{name:'Инструменты',exact:true})).toHaveCount(0)
  await expect(page.locator('.page-forward-enter-active,.page-backward-enter-active')).toHaveCount(0)
  await page.evaluate(()=>document.fonts.ready)
  return {header,tools}
}

async function layout(page,header,tools,width,info) {
  const music=header.locator('.chapter-music-tab')
  await expect(music).toHaveAttribute('aria-label',`${trackName} · ПАУЗА`)
  await expect(music.getByRole('button')).toHaveCount(width<1200?1:3)
  if(width<1200){
    await expect(music.getByRole('button',{name:'Музыка',exact:true})).toBeVisible()
    await expect(music.locator('.chapter-music-title,.chapter-music-controls,.chapter-music-progress')).toHaveCount(0)
  }else await expect(music.locator('.chapter-music-title')).toContainText(trackName)
  await expect.poll(()=>header.evaluate((node,width)=>{
    const bounds=node.getBoundingClientRect(),buttons=[...node.querySelectorAll('.session-toolbar-tools > button')]
    const music=node.querySelector('.chapter-music-tab button')
    const fits=button=>{const box=button.getBoundingClientRect();return box.left>=bounds.left-.5&&box.right<=bounds.right+.5&&box.top>=bounds.top-.5&&box.bottom<=bounds.bottom+.5}
    return buttons.length===4&&buttons.every(button=>fits(button)&&button.offsetWidth>=48&&button.offsetHeight>=48)
      &&fits(music)&&document.documentElement.scrollWidth<=width
  },width)).toBe(true)
  const bounds=await header.boundingBox()
  const controls=[...await tools.getByRole('button').all(),...(width<1200?[await music.getByRole('button').first()]:[])]
  for(const button of controls){
    await expect(button).toBeInViewport()
    const box=await button.boundingBox()
    expect(box.width).toBeGreaterThanOrEqual(48)
    expect(box.height).toBeGreaterThanOrEqual(48)
    expect(box.x).toBeGreaterThanOrEqual(bounds.x-.5)
    expect(box.x+box.width).toBeLessThanOrEqual(bounds.x+bounds.width+.5)
    expect(box.y+box.height).toBeLessThanOrEqual(bounds.y+bounds.height+.5)
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await info.attach(`toolbar-${width}`,{body:await header.screenshot(),contentType:'image/png'})
}

for(const width of [475,704,1440])test(`direct session tools and music header at ${width}`,async({page},info)=>{
  const {header,tools}=await open(page,width)
  await layout(page,header,tools,width,info)
  for(const [name,panel] of [['Экран показа','.presentation-menu'],['Таймеры','.session-timer-menu'],['Кубики','.dice-panel'],['Инвентарь','.session-inventory']]){
    const button=tools.getByRole('button',{name,exact:true})
    await button.click()
    await expect(button).toHaveAttribute('aria-expanded','true')
    await expect(page.locator(panel)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(button).toHaveAttribute('aria-expanded','false')
    await expect(page.locator(panel)).toHaveCount(0)
  }
  await tools.getByRole('button',{name:'Кубики',exact:true}).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.dice-panel')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.locator('.session-graph-canvas').focus()
  await page.keyboard.press('Shift+D')
  await expect(page.locator('.dice-panel')).toBeVisible()
  await page.keyboard.press('Escape')
  await header.locator('.chapter-music-tab').getByRole('button').first().click()
  await expect(header.locator('.chapter-music-tab').getByRole('button').first()).toHaveAttribute('aria-current','page')
  await expect(page.locator('.session-music-workspace')).toBeVisible()
})

test('live header resizing preserves the timer draft and switches music presentation',async({page},info)=>{
  const {header,tools}=await open(page,475)
  for(const [index,width] of [475,704,1440,390,475].entries()){
    await page.setViewportSize({width,height:932})
    await layout(page,header,tools,width,info)
    await tools.getByRole('button',{name:'Таймеры',exact:true}).click()
    const description=page.locator('.session-timer-description input')
    if(index===0)await description.fill('Сохранить черновик')
    else await expect(description).toHaveValue('Сохранить черновик')
    await page.keyboard.press('Escape')
  }
})
