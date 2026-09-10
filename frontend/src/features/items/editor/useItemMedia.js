import { onScopeDispose, reactive } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'

export function useItemMedia() {
  const slots = reactive({ icon: { file: null, preview: '', removed: false }, cover: { file: null, preview: '', removed: false } })
  function revoke(slot) { if (slot.preview) URL.revokeObjectURL(slot.preview); slot.preview = '' }
  function select(kind, file) {
    const allowed = kind === 'cover' ? ['image/png', 'image/webp', 'image/jpeg'] : ['image/png', 'image/webp']
    if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024 || !file.size) throw new Error('Выберите изображение поддерживаемого формата размером до 5 МБ.')
    const slot = slots[kind]; revoke(slot); slot.file = file; slot.preview = URL.createObjectURL(file); slot.removed = false
  }
  function remove(kind) { const slot = slots[kind]; revoke(slot); slot.file = null; slot.removed = true }
  async function save(saved) {
    for (const kind of ['icon', 'cover']) {
      const slot = slots[kind]
      if (slot.file) {
        const result = await (kind === 'icon' ? itemsApi.uploadIconImage : itemsApi.uploadCoverImage)(saved.id, slot.file)
        Object.assign(saved, result, kind === 'icon' ? { iconSvgId: null, svg: null } : {})
      } else if (slot.removed) {
        await (kind === 'icon' ? itemsApi.clearIcon : itemsApi.clearCover)(saved.id)
        Object.assign(saved, { [`${kind}ImageId`]: null, [`${kind}ImageUrl`]: null }, kind === 'icon' ? { iconSvgId: null, svg: null } : {})
      } else continue
      slot.file = null; slot.removed = false
    }
    return saved
  }
  onScopeDispose(() => Object.values(slots).forEach(revoke))
  return { slots, select, remove, save }
}
