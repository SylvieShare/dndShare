import { describe, expect, it } from 'vitest'
import { dndStatusSummary, hasDndStatusSummary } from './dndStatusSummary'

const blessing = { uid:'bless', title:'Благословение', description:'Бонус к броскам', polarity:'positive', item:{id:701,data:{}} }
describe('the shared sheet and participant status summary',()=>{
  it('keeps an applied effect and inspiration as two distinct rows',()=>{
    const rows=dndStatusSummary({statuses:[blessing],values:{inspiration:true}})
    expect(rows.map(row=>[row.id,row.kind,row.value])).toEqual([['bless','states','Благословение'],['inspiration','inspiration','Вдохновение']])
  })
  it('keeps an applied effect and exhaustion with the active configured effects',()=>{
    const values={exhaustion:Object.freeze({level:9,max:2,effects:['Первый','Второй']})}
    const rows=dndStatusSummary({statuses:[blessing],values})
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({id:'exhaustion',kind:'exhaustion',level:2,desc:'Первый · Второй'})
    expect(values.exhaustion.level).toBe(9)
  })
  it('shows intrinsic statuses even when there are no applied effects',()=>{
    const values={states:[],inspiration:true,exhaustion:{level:1}}
    expect(hasDndStatusSummary(values)).toBe(true)
    expect(dndStatusSummary({values}).map(row=>row.kind)).toEqual(['exhaustion','inspiration'])
  })
  it.each([{}, {states:[],inspiration:false,exhaustion:{level:0}}, {inspiration:'0',exhaustion:{level:-1}}])('does not create empty status rows for %j',values=>{
    expect(hasDndStatusSummary(values)).toBe(false)
    expect(dndStatusSummary({values})).toEqual([])
  })
  it('recognizes applied effects before their catalogue artwork arrives',()=>{
    expect(hasDndStatusSummary({states:[{uid:'effect',effect_id:701}]})).toBe(true)
  })
  it.each([['2014','Вдохновение'],['2024','Героическое вдохновение']])('uses the %s inspiration name', (rulesVersion,value)=>{
    expect(dndStatusSummary({values:{inspiration:1},rulesVersion})[0]).toMatchObject({kind:'inspiration',value})
  })
  it('preserves custom sheet field identifiers and catalogue display data',()=>{
    const item={id:702,name:'Утомление',data:{thesis:'Отдых',color:'var(--warning)'}}
    const rows=dndStatusSummary({values:{tired:{level:1},hero:true},exhaustionId:'tired',inspirationId:'hero',itemByCode:code=>code==='exhaustion'?item:null})
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({item,value:'Утомление',thesis:'Отдых',color:'var(--warning)'})
  })
  it('preserves explicit effect levels and both concentration labels',()=>{
    const rows=dndStatusSummary({statuses:[
      {...blessing,params:{level:3},concentration:true},
      {...blessing,uid:'sender',requires_concentration:true,concentration_owner:'source'},
    ]})
    expect(rows[0].level).toBe(3)
    expect(rows[0].duration).toContain(' · концентрация')
    expect(rows[1].duration).toContain(' · концентрация отправителя')
  })
})
