// Single source of truth for the six D&D ability dictionaries. These were
// copy-pasted across the create wizard, character-build helpers, item detail
// views and spell cards, which let the maps drift apart. Two abbreviation
// conventions exist on purpose: STAT_SHORT is the character-sheet form
// (uppercase keys, "ЛОВ/ВЫН"); SAVE_ABBR is the monster/spell stat-block form
// (lowercase keys, "ЛВК/ТЕЛ"). Keep them separate — they are not duplicates.

export const STAT_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

export const STAT_SHORT = { STR: 'СИЛ', DEX: 'ЛОВ', CON: 'ВЫН', INT: 'ИНТ', WIS: 'МДР', CHA: 'ХАР' }

export const STAT_FULL = { STR: 'Сила', DEX: 'Ловкость', CON: 'Выносливость', INT: 'Интеллект', WIS: 'Мудрость', CHA: 'Харизма' }

export const SUGGEST16_TO_STAT = { 1: 'STR', 2: 'DEX', 3: 'CON', 4: 'INT', 5: 'WIS', 6: 'CHA' }

export const SAVE_ABBR = { str: 'СИЛ', dex: 'ЛВК', con: 'ТЕЛ', int: 'ИНТ', wis: 'МДР', cha: 'ХАР' }
