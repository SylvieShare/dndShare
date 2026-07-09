export const SLOT_LEVELS = 9

export const SPELL_LEVELS = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

export function defaultSlots() {
  return Array.from({ length: SLOT_LEVELS }, (_, i) => ({ level: i + 1, total: 0, used: 0 }))
}

export { formatBonus } from '@/shared/lib/dnd'

export function plainText(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function componentsLabel(components) {
  if (!components) return ''
  return [
    components.v ? 'В' : '',
    components.s ? 'С' : '',
    components.m ? 'М' : '',
  ].filter(Boolean).join(' · ')
}

export function spellSummary(item) {
  const text = plainText(item?.data?.description)
  if (!text) return ''
  const sentence = text.match(/^(.+?[.!?])(\s|$)/)?.[1] || text
  return sentence.length > 96 ? sentence.slice(0, 93).trim() + '...' : sentence
}

export function groupTitle(level) {
  if (level === 0) return 'Заговоры · неогр.'
  if (level == null || level < 0) return 'Без уровня'
  return `${level} круг`
}

// Источник заклинания (data.source_kind). Заполняется ttg-обогащением:
// base = книга правил (PHB), addon = офиц. дополнение (Котёл Таши и т.п.), third = стороннее (контент игроков).
export const SPELL_SOURCE_KIND = { BASE: 'base', ADDON: 'addon', THIRD: 'third' }
export const SPELL_SOURCE_KIND_LABELS = { base: 'База', addon: 'Дополнение', third: 'Стороннее' }

// Тип роста урона/лечения (data.damage.scaling / data.heal.scaling):
// none = фиксировано, slot = +addon за круг ячейки выше базового, cantrip = +addon по уровню героя (5/11/17).
export const SPELL_DAMAGE_SCALING = { NONE: 'none', SLOT: 'slot', CANTRIP: 'cantrip' }
export const SPELL_DAMAGE_SCALING_LABELS = { none: 'нет', slot: 'за круг ячейки', cantrip: 'за уровень героя' }
