import {test,expect} from '@playwright/test'

const svg=(color,width=1600,height=640)=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/><circle cx="50%" cy="50%" r="24%" fill="#ddd"/></svg>`)
const typeCover=svg('#314359'),ownCover=svg('#574379'),icon=svg('#46a7aa',128,128)
const dictionary={id:34,name:'Характеристики',sourceId:3,sourceName:'Cyberpunk',countItems:2,iconImageUrl:icon,coverImageUrl:typeCover}
const items=[{id:385,typeId:34,value:'Интеллект',code:'INT',desc:'Способность анализировать информацию.',iconImageUrl:icon,coverImageUrl:ownCover},{id:386,typeId:34,value:'Реакция',code:'REF',desc:'Быстрота реакции.'}]

for(const width of [390,840,1440])test(`dictionary independent media and type fallback at ${width}`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000})
 const errors=[];page.on('pageerror',error=>errors.push(error.message))
 await page.route(url=>url.pathname.startsWith('/api/'),route=>{
  const path=new URL(route.request().url()).pathname
  return route.fulfill({json:{
   '/api/user/checkAuth':{auth:false},'/api/build-info':{backend:{apiContract:1},frontend:{version:'0.0.0',build:0}},
   '/api/sources':{sources:[{id:3,name:'Cyberpunk',versions:[{id:1800,sourceId:3,version:'RED'}]}]},
   '/api/suggest/types':{items:[dictionary]},'/api/suggest/34':{items},'/api/item-types':{types:[]},
   '/api/templates':{templates:[]},'/api/account/tutorials':{tutorials:[]},
  }[path]||{}})
 })
 await page.goto('/handbook/dictionary?type=34&item=385')
 const panel=page.locator('.dict-editor-slot')
 await expect(panel.locator('.item-detail-title h1')).toHaveText('Интеллект',{timeout:25000})
 await expect(panel.locator('.item-detail-cover')).toHaveAttribute('src',ownCover)
 await expect(panel.locator('.item-icon__image')).toHaveAttribute('src',icon)
 await expect.poll(()=>panel.locator('.item-detail-header').evaluate(e=>e.getBoundingClientRect().height/e.getBoundingClientRect().width)).toBeLessThan(.65)
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await expect(panel.locator('.item-detail-header')).toHaveCSS('margin-left','0px')
 await testInfo.attach('dictionary-'+width,{body:await page.screenshot(),contentType:'image/png'})
 await page.goto('/handbook/dictionary?type=34&item=386')
 await expect(panel.locator('.item-detail-title h1')).toHaveText('Реакция')
 await expect(panel.locator('.item-detail-cover')).toHaveAttribute('src',typeCover)
 await expect(panel.locator('.item-icon__image')).toHaveAttribute('src',icon)
 await page.goto('/handbook')
 await expect(page.locator('.hb-dict-card .item-icon__image')).toHaveAttribute('src',icon)
 expect(errors).toEqual([])
})
