import { expect,it } from 'vitest'
import { statusIconItem } from './statusIcon'
it('uses catalog icons, then local condition artwork, with a generic fallback',()=>{
  const own={iconImageUrl:'/media/condition.png',data:{code:'poisoned'}}
  expect(statusIconItem({item:own})).toBe(own)
  expect(statusIconItem({item:{data:{code:'blinded'}}}).svg).toBe('/static/conditions/blinded.svg')
  expect(statusIconItem({value:'Отравление'}).svg).toBe('/static/conditions/poisoned.svg')
  expect(statusIconItem({item:own},true)).toMatchObject({iconImageUrl:'',svg:'/static/conditions/poisoned.svg'})
  expect(statusIconItem({value:'Авторский эффект'})).toBeNull()
})
