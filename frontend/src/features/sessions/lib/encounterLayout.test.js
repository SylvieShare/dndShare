import { expect,it } from 'vitest'
import { encounterColumnsMinWidth,encounterPrimaryWidth,encounterPreviewFits } from './encounterLayout'

it('reserves the full roster, scrollbar gap, column gap and preview minimum',()=>{
  expect(encounterColumnsMinWidth).toBe(788)
  expect(encounterPrimaryWidth).toBe(492)
  expect(encounterPreviewFits(787)).toBe(false)
  expect(encounterPreviewFits(788)).toBe(true)
  expect(encounterPreviewFits(789)).toBe(true)
})
it.each([undefined,NaN,Infinity,-1,0])('keeps the preview hidden for unavailable width %s',width=>{
  expect(encounterPreviewFits(width)).toBe(false)
})
