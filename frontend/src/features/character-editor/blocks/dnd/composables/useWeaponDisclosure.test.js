import { reactive, ref } from 'vue'
import { expect, it } from 'vitest'
import { useWeaponDisclosure } from './useWeaponDisclosure'

it('follows a weapon UID through remounts and does not carry state to another character', () => {
  const character = reactive({}), uid = ref('one')
  const original = useWeaponDisclosure(character, () => uid.value)
  original.toggle()
  expect(original.collapsed.value).toBe(true)
  uid.value = 'two'
  expect(original.collapsed.value).toBe(false)
  uid.value = 'one'
  expect(useWeaponDisclosure(character, () => 'one').collapsed.value).toBe(true)
  expect(useWeaponDisclosure(reactive({}), () => 'one').collapsed.value).toBe(false)
  original.toggle()
  expect(original.collapsed.value).toBe(false)
  expect(Object.keys(character)).toEqual([])
})
