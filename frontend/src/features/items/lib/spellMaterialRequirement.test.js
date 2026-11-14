import {describe,it,expect} from 'vitest'
import {spellMaterialRequirement} from './spellMaterialRequirement'

describe('explicit spell material prices',()=>{
 it('extracts the catalogue revivify requirement without dropping consumption',()=>{
  expect(spellMaterialRequirement({m:'бриллианты, стоящие в сумме 300 зм, расходуемые заклинанием'})).toMatchObject({name:'бриллианты, расходуемые заклинанием',priceLabel:'300 зм'})
 })
 it('retains the additional item and the minimum price for identify',()=>{
  expect(spellMaterialRequirement({m:'жемчужина, стоящая как минимум 100 зм, и перо совы'})).toMatchObject({name:'жемчужина и перо совы',priceLabel:'от 100 зм'})
 })
 it.each([
  ['бриллиант, стоящий как минимум 1\u00a0000 зм','от 1 000 зм'],
  ['оружие стоимостью не менее 1 см.','от 1 см'],
  ['порошок рубина на 50 зм, расходуемый заклинанием','50 зм'],
  ['Гонорарный (1 зм)','1 зм'],
  ['ладан стоимостью хотя бы 500 зм.','от 500 зм'],
  ['жемчуг worth at least 100 gp','от 100 зм'],
  ['порошок стоимостью 0,5 зм','0,5 зм'],
  ['объект стоимостью 100–200 зм','100–200 зм'],
  ['объект стоимостью не меньше 75 золотых','от 75 зм'],
 ])('reads explicit currencies in %s',(m,priceLabel)=>expect(spellMaterialRequirement({m})?.priceLabel).toBe(priceLabel))
 it.each(['25 зм или минералы равноценной стоимости, расходуемые заклинанием','шестерёнка, стоящая 100 зм за каждый уровень заклинания','каждый предмет должен стоить как минимум 5 зм'])('keeps conditional price context: %s',m=>expect(spellMaterialRequirement({m})?.name).toBe(m))
 it('does not sum multiple prices or lose their context',()=>{
  const m='алмаз стоимостью 100 зм или рубин стоимостью 200 зм'
  expect(spellMaterialRequirement({m})).toMatchObject({name:m,priceLabel:'100 зм · 200 зм'})
 })
 it.each([undefined,{}, {m:true},{m:'Светлячок'},{m:'серебряная проволока длиной 20 см'},{m:'пластина толщиной 2 мм'},{m:'100 золотых пластинок'},{m:'0 зм'},{m:'-100 зм'},{m:'1 змея'}])('does not invent a material price for %j',components=>expect(spellMaterialRequirement(components)).toBeNull())
})
