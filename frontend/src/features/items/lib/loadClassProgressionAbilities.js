import { itemsApi } from '@/shared/api/itemsApi'

export function loadClassProgressionAbilities(classId) {
  // The API traverses object arrays only through their explicit .id path.
  return itemsApi.listAll(4, {}, { 'class_ids.id': [classId] })
}
