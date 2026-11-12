import { expect,it } from 'vitest'
import { statusIconItem } from './statusIcon'
it('uses catalog icons, then local condition artwork, with a generic fallback',()=>{
  const own={iconImageUrl:'/media/condition.png',data:{code:'poisoned'}}
  expect(statusIconItem({item:own})).toBe(own)
  expect(statusIconItem({item:{data:{code:'blinded'}}}).iconImageUrl).toBe('/static/conditions/blinded.svg')
  expect(statusIconItem({value:'Отравление'}).iconImageUrl).toBe('/static/conditions/poisoned.svg')
  expect(statusIconItem({item:own},true)).toMatchObject({iconImageUrl:'/static/conditions/poisoned.svg',svg:''})
  const deferred={svgId:99};expect(statusIconItem({item:deferred})).toBe(deferred)
  const stored={iconSvgId:100,data:{code:'poisoned'}}
  expect(statusIconItem({item:stored})).toBe(stored)
  expect(statusIconItem({item:stored},true)).toMatchObject({iconImageUrl:'/static/conditions/poisoned.svg',iconSvgId:null,svgId:null})
  expect(statusIconItem({value:'Авторский эффект'})).toBeNull()
})
