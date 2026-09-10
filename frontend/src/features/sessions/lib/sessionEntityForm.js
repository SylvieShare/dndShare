import { Badge, Gift, GitFork, KeyRound, NotebookPen, ScrollText, Target, UserRound, MapPin, LibraryBig } from '@lucide/vue'
import { LOCATION_KINDS } from './sessionWorld'
import { QUEST_STATUSES } from './sessionEntityRelations'
import { MATERIAL_TYPES, NOTE_STYLES } from './sessionMaterials'

export function entityDraft(type, entity = {}, defaults = {}) {
  const source = entity || {}
  return {
    name: source.name || '',
    relations: (source.relations || (defaults.locationId ? [{ type: 'location', id: Number(defaults.locationId), note: null }] : [])).map(item => ({ ...item })),
    description: source.description || '',
    kind: source.kind || (type === 'location' ? 'settlement' : 'image'),
    parentLocationId: source.parentLocationId || defaults.parentId || '',
    raceItemId: source.raceItemId || '',
    bestiaryItemId: source.bestiaryItemId || '',
    role: source.role || '',
    color: source.color || '#7c5cff',
    image: { id: source.imageId || 0, url: source.imageUrl || '', focalX: source.imageFocalX ?? .5, focalY: source.imageFocalY ?? .5 },
    asset: { id: source.assetId || 0, url: source.assetUrl || '' },
    status: source.status || 'planned',
    goal: source.goal || '', condition: source.condition || '', reward: source.reward || '',
    consequences: source.consequences || '', notes: source.notes || '',
    content: source.content || '', caption: source.caption || '', noteStyle: source.noteStyle || 'parchment',
  }
}

export function entityPayload(type, draft) {
  const base = { name: draft.name.trim(), relations: draft.relations.map(item => ({ ...item })) }
  const nullable = value => value.trim() || null
  if (type === 'location') return { ...base, kind: draft.kind, parentLocationId: Number(draft.parentLocationId) || null, description: nullable(draft.description), imageId: draft.image.id || null }
  if (type === 'npc') return {
    ...base, raceItemId: Number(draft.raceItemId) || null, bestiaryItemId: Number(draft.bestiaryItemId) || null,
    role: nullable(draft.role), description: nullable(draft.description), color: draft.color,
    imageId: draft.image.id || null, imageFocalX: draft.image.focalX ?? .5, imageFocalY: draft.image.focalY ?? .5,
  }
  if (type === 'quest') return {
    ...base, status: draft.status, goal: nullable(draft.goal), condition: nullable(draft.condition),
    reward: nullable(draft.reward), consequences: nullable(draft.consequences), notes: nullable(draft.notes),
  }
  const text = ['text', 'note'].includes(draft.kind)
  return { ...base, kind: draft.kind, caption: text ? null : nullable(draft.caption), content: text ? draft.content.trim() : null, noteStyle: draft.kind === 'note' ? draft.noteStyle : null, assetId: text ? null : draft.asset.id }
}

export function entityDraftValid(type, draft) {
  if (!draft.name.trim()) return false
  if (type === 'material') return ['text', 'note'].includes(draft.kind) ? !!draft.content.trim() : !!draft.asset.id
  return true
}

export function entityFields(type, draft) {
  const icons = { goal: Target, condition: KeyRound, reward: Gift, consequences: GitFork, notes: NotebookPen, description: NotebookPen }
  const text = (key, label, maxlength = 5000, rows = 5) => ({ key, label, icon: icons[key], input: 'text', multiline: true, maxlength, rows, wide: true })
  const select = (key, label, options) => ({ key, label, input: 'select', options })
  const fields = [{ key: 'name', icon: { npc: UserRound, location: MapPin, quest: ScrollText, material: LibraryBig }[type], label: type === 'npc' ? 'Имя' : 'Название', input: 'text', maxlength: 160, required: true }]
  if (type === 'npc') return [...fields,
    { key: 'raceItemId', label: 'Раса', input: 'race' },
    { key: 'role', icon: Badge, label: 'Роль', input: 'text', maxlength: 160 },
    { key: 'image', label: 'Портрет', input: 'image', catalog: 'npc', allowUpload: true },
    { key: 'color', label: 'Цвет карточки', input: 'color' },
    text('description', 'Характер, мотивация и заметки'),
    { key: 'bestiaryItemId', label: 'Бестиарий', input: 'bestiary', wide: true },
  ]
  if (type === 'location') {
    return [...fields, select('kind', 'Тип', LOCATION_KINDS),
      { key: 'image', label: 'Изображение', input: 'image', catalog: 'story' }, text('description', 'Описание и атмосфера')]
  }
  if (type === 'quest') return [...fields, select('status', 'Статус', QUEST_STATUSES), text('goal', 'Цель'), text('condition', 'Условие'), text('reward', 'Награда'), text('consequences', 'Последствия'), text('notes', 'Заметки')]
  return [...fields, select('kind', 'Тип материала', MATERIAL_TYPES),
    ...(['text', 'note'].includes(draft.kind)
      ? [{ ...text('content', draft.kind === 'note' ? 'Текст записки' : 'Текст материала', 20000, 9), required: true }]
      : [{ key: 'asset', wide: true, label: draft.kind === 'video' ? 'Видеофайл' : 'Изображение', input: draft.kind === 'video' ? 'video' : 'image', allowUpload: true }, text('caption', 'Подпись для игроков', 2000, 3)]),
    ...(draft.kind === 'note' ? [select('noteStyle', 'Оформление записки', NOTE_STYLES)] : []),
  ]
}
