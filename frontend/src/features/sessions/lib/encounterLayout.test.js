import { expect,it } from 'vitest'
import { encounterColumnsMinWidth,encounterPrimaryWidth,encounterColumnsFit } from './encounterLayout'

it('reserves the full roster, scrollbar gap, column gap and preview minimum',()=>{
  expect(encounterColumnsMinWidth).toBe(628)
  expect(encounterPrimaryWidth).toBe(492)
  expect(encounterColumnsFit(627)).toBe(false)
  expect(encounterColumnsFit(628)).toBe(true)
  expect(encounterColumnsFit(629)).toBe(true)
})
it.each([undefined,NaN,Infinity,-1,0])('keeps the preview hidden for unavailable width %s',width=>{
  expect(encounterColumnsFit(width)).toBe(false)
})
