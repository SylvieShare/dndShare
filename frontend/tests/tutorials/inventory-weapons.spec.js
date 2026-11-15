import { test,expect } from '@playwright/test'
import { weaponSheetFixture } from './fixtures/weapon-sheet.js'

async function open(page,{owner=true,alreadyEquipped=false}={}) {
  page.on('pageerror',error=>{throw error})
  await page.setViewportSize({width:704,height:932})
  const api=await weaponSheetFixture(page,owner)
  Object.assign(api.catalogue,{
    202:{id:202,typeId:19,name:'Магическое копьё',data:{activation:'equipped',attunement:'none',weapon:{base_item_id:201,magic_bonus:1}}},
    301:{id:301,typeId:12,name:'Кожаный доспех',data:{armor:{ac:11,use_dex:true}}},
    302:{id:302,typeId:19,name:'Магический плащ',data:{activation:'equipped',attunement:'none'}},
  })
  const ordinary={uid:'ordinary',item_id:201,count:2,params:{magic_bonus:1},desc:'Памятная гравировка',proficient:true}
  const magic={uid:'magic',item_id:202,count:1,params:{magic:{attuned:true,remaining:3}},desc:'Три заряда'}
  api.document().values.weapon=[]
  api.document().values.items={equipped:alreadyEquipped?[magic]:[],sections:[{id:'bag',name:'Рюкзак',items:[ordinary,...(alreadyEquipped?[]:[magic]),
    {uid:'armor',item_id:301,count:1,params:{}},{uid:'cloak',item_id:302,count:1,params:{}}],slots:{ordinary:0,magic:1,armor:2,cloak:3}}]}
  await page.goto('/char/test?tab=inventory')
  const inventory=page.locator('[data-sheet-section="inventory"]:visible')
  await expect(inventory.getByRole('button',{name:'Тестовое копьё',exact:true})).toBeVisible()
  await expect(page.locator('.page-forward-enter-active,.page-backward-enter-active')).toHaveCount(0)
  const menu=name=>page.getByRole('menu',{name:`Действия: ${name}`,exact:true})
  async function itemMenu(name){await inventory.getByRole('button',{name,exact:true}).click();await expect(menu(name)).toBeVisible();return menu(name)}
  return {api,inventory,itemMenu}
}

test('ordinary and magic weapons move to weapons while armor and wearable magic still equip',async({page},info)=>{
  const {api,inventory,itemMenu}=await open(page)
  for(const name of ['Тестовое копьё','Магическое копьё']){
    await expect(inventory.getByRole('button',{name,exact:true}).locator('[title="Можно надеть"]')).toHaveCount(0)
    const menu=await itemMenu(name)
    await expect(menu.getByRole('menuitem',{name:'Экипировать',exact:true})).toHaveCount(0)
    if(name==='Тестовое копьё')await info.attach('weapon-menu',{body:await menu.screenshot(),contentType:'image/png'})
    await menu.getByRole('menuitem',{name:'Переместить в «Оружие»',exact:true}).click()
    await expect(inventory.getByRole('button',{name,exact:true})).toHaveCount(0)
  }
  await expect.poll(()=>api.document().values.weapon.length).toBe(3)
  const weapons=api.document().values.weapon
  expect(new Set(weapons.map(entry=>entry.uid)).size).toBe(3)
  expect(weapons.filter(entry=>!entry.magic_item_id)).toHaveLength(2)
  expect(weapons.find(entry=>entry.uid==='ordinary')).toMatchObject({item_id:201,params:{magic_bonus:1},desc:'Памятная гравировка',proficient:true})
  expect(weapons.find(entry=>entry.uid==='magic')).toMatchObject({item_id:201,magic_item_id:202,params:{magic:{attuned:true,remaining:3}},desc:'Три заряда'})
  expect(api.document().values.items.equipped).toEqual([])
  for(const name of ['Кожаный доспех','Магический плащ']){
    const menu=await itemMenu(name)
    await menu.getByRole('menuitem',{name:'Экипировать',exact:true}).click()
  }
  await expect.poll(()=>api.document().values.items.equipped.map(entry=>entry.uid)).toEqual(['armor','cloak'])
  await page.reload()
  await expect(inventory.getByRole('button',{name:'Тестовое копьё',exact:true})).toHaveCount(0)
  await expect(inventory.getByRole('button',{name:'Кожаный доспех',exact:true})).toHaveAttribute('aria-description','Экипировано')
  await page.getByRole('navigation',{name:'Раздел персонажа',exact:true}).getByRole('button',{name:'Оружие',exact:true}).click()
  const pane=page.locator('[data-sheet-section="weapons"]:visible')
  await expect(pane.getByText('Магическое копьё',{exact:true})).toBeVisible()
  await expect(pane.locator('.w-name').filter({hasText:/^Тестовое копьё$/})).toHaveCount(2)
})

test('an existing equipped weapon can move directly without an automatic change on load',async({page})=>{
  const {api,itemMenu}=await open(page,{alreadyEquipped:true})
  expect(api.writes).toHaveLength(0)
  expect(api.document().values.items.equipped[0].uid).toBe('magic')
  const menu=await itemMenu('Магическое копьё')
  await expect(menu.getByRole('menuitem',{name:'Экипировать',exact:true})).toHaveCount(0)
  await menu.getByRole('menuitem',{name:'Переместить в «Оружие»',exact:true}).click()
  await expect.poll(()=>api.document().values.weapon.map(entry=>entry.uid)).toEqual(['magic'])
  expect(api.document().values.items.equipped).toEqual([])
  expect(api.document().values.weapon[0]).toMatchObject({magic_item_id:202,params:{magic:{attuned:true,remaining:3}},desc:'Три заряда'})
})

test('a reader can inspect a weapon without equipment or move actions',async({page})=>{
  const {api,itemMenu}=await open(page,{owner:false})
  const menu=await itemMenu('Тестовое копьё')
  await expect(menu.getByRole('menuitem',{name:'Экипировать',exact:true})).toHaveCount(0)
  await expect(menu.getByRole('menuitem',{name:'Переместить в «Оружие»',exact:true})).toHaveCount(0)
  expect(api.writes).toHaveLength(0)
})
