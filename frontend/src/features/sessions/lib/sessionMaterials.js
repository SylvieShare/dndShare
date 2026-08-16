import { FileText, Image, Map, ScrollText, Video } from '@lucide/vue'

export const MATERIAL_TYPES = [
  { key: 'image', label: 'Картинка', icon: Image, hint: 'Иллюстрация или раздаточный материал' },
  { key: 'video', label: 'Видео', icon: Video, hint: 'Ролик для экрана игроков' },
  { key: 'text', label: 'Текст', icon: FileText, hint: 'Чистый текст без оформления' },
  { key: 'note', label: 'Записка', icon: ScrollText, hint: 'Стилизованное письмо или документ' },
  { key: 'map', label: 'Карта', icon: Map, hint: 'Пока изображение; позже — слои и метки' },
]

export const NOTE_STYLES = [
  { key: 'parchment', label: 'Пергамент' },
  { key: 'letter', label: 'Письмо' },
  { key: 'dossier', label: 'Досье' },
  { key: 'arcane', label: 'Магическая' },
]

export function materialType(kind) {
  return MATERIAL_TYPES.find(item => item.key === kind) || MATERIAL_TYPES[0]
}
