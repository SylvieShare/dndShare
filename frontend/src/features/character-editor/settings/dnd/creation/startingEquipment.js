/**
 * Player's Handbook (2014) starting-equipment choices for the twelve base
 * classes. The wizard stores only choice ids and the concrete names picked for
 * "any weapon/instrument" clauses; this module turns them into inventory rows.
 */

const SIMPLE_MELEE = [
  'Дубинка', 'Кинжал', 'Палица', 'Ручной топор', 'Метательное копьё',
  'Лёгкий молот', 'Булава', 'Боевой посох', 'Серп', 'Копьё',
]
const SIMPLE_RANGED = ['Лёгкий арбалет', 'Дротик', 'Короткий лук', 'Праща']
const SIMPLE_WEAPONS = [...SIMPLE_MELEE, ...SIMPLE_RANGED]
const MARTIAL_MELEE = [
  'Боевой топор', 'Цеп', 'Глефа', 'Секира', 'Двуручный меч', 'Алебарда',
  'Длинное копьё', 'Длинный меч', 'Молот', 'Моргенштерн', 'Пика', 'Рапира', 'Скимитар',
  'Короткий меч', 'Трезубец', 'Боевая кирка', 'Боевой молот', 'Кнут',
]
const MARTIAL_RANGED = ['Духовая трубка', 'Ручной арбалет', 'Тяжёлый арбалет', 'Длинный лук', 'Сеть']
const MARTIAL_WEAPONS = [...MARTIAL_MELEE, ...MARTIAL_RANGED]
const MUSICAL_INSTRUMENTS = ['Волынка', 'Барабаны', 'Цимбалы', 'Флейта', 'Лира', 'Рожок', 'Свирель', 'Шалмей', 'Виола']
const ARCANE_FOCI = ['Кристалл', 'Сфера', 'Жезл', 'Посох', 'Волшебная палочка']
const DRUIDIC_FOCI = ['Веточка омелы', 'Тотем', 'Деревянный посох', 'Тисовая палочка']
const HOLY_SYMBOLS = ['Амулет', 'Эмблема', 'Реликварий']

const item = (name, count = 1) => ({ name, count })
const pick = (id, label, options, count = 1) => ({ id, label, options, count })
const option = (id, label, items = [], picks = []) => ({ id, label, items, picks })
const group = (id, options, label = '') => ({ id, label, options })

const crossbow = [item('Лёгкий арбалет'), item('Арбалетный болт', 20)]
const shortbow = [item('Короткий лук'), item('Колчан'), item('Стрела', 20)]
const longbow = [item('Длинный лук'), item('Стрела', 20)]
const longbowWithQuiver = [item('Длинный лук'), item('Колчан'), item('Стрела', 20)]

const PROFILES = {
  barbarian: {
    groups: [
      group('weapon_1', [
        option('greataxe', 'Секира', [item('Секира')]),
        option('martial_melee', 'Любое воинское рукопашное оружие', [], [pick('weapon', 'Оружие', MARTIAL_MELEE)]),
      ]),
      group('weapon_2', [
        option('handaxes', 'Два ручных топора', [item('Ручной топор', 2)]),
        option('simple', 'Любое простое оружие', [], [pick('weapon', 'Оружие', SIMPLE_WEAPONS)]),
      ]),
    ],
    fixed: [item('Набор путешественника'), item('Метательное копьё', 4)],
  },
  bard: {
    groups: [
      group('weapon', [
        option('rapier', 'Рапира', [item('Рапира')]),
        option('longsword', 'Длинный меч', [item('Длинный меч')]),
        option('simple', 'Любое простое оружие', [], [pick('weapon', 'Оружие', SIMPLE_WEAPONS)]),
      ]),
      group('pack', [
        option('diplomat', 'Набор дипломата', [item('Набор дипломата')]),
        option('entertainer', 'Набор артиста', [item('Набор артиста')]),
      ]),
      group('instrument', [
        option('lute', 'Лютня', [item('Лютня')]),
        option('other', 'Любой другой музыкальный инструмент', [], [pick('instrument', 'Инструмент', MUSICAL_INSTRUMENTS)]),
      ]),
    ],
    fixed: [item('Кожаный доспех'), item('Кинжал')],
  },
  cleric: {
    groups: [
      group('weapon', [option('mace', 'Булава', [item('Булава')]), option('warhammer', 'Боевой молот (если владеете)', [item('Боевой молот')])]),
      group('armor', [
        option('scale', 'Чешуйчатый доспех', [item('Чешуйчатый доспех')]),
        option('leather', 'Кожаный доспех', [item('Кожаный доспех')]),
        option('chain', 'Кольчуга (если владеете)', [item('Кольчуга')]),
      ]),
      group('ranged', [
        option('crossbow', 'Лёгкий арбалет и 20 болтов', crossbow),
        option('simple', 'Любое простое оружие', [], [pick('weapon', 'Оружие', SIMPLE_WEAPONS)]),
      ]),
      group('pack', [option('priest', 'Набор священника', [item('Набор священника')]), option('explorer', 'Набор путешественника', [item('Набор путешественника')])]),
    ],
    fixed: [item('Щит')],
    fixedPicks: [pick('holy_symbol', 'Священный символ', HOLY_SYMBOLS)],
  },
  druid: {
    groups: [
      group('weapon_1', [option('shield', 'Деревянный щит', [item('Деревянный щит')]), option('simple', 'Одно простое оружие', [], [pick('weapon', 'Оружие', SIMPLE_WEAPONS)])]),
      group('weapon_2', [option('scimitar', 'Скимитар', [item('Скимитар')]), option('simple_melee', 'Простое рукопашное оружие', [], [pick('weapon', 'Оружие', SIMPLE_MELEE)])]),
    ],
    fixed: [item('Кожаный доспех'), item('Набор путешественника')],
    fixedPicks: [pick('druidic_focus', 'Фокусировка друидов', DRUIDIC_FOCI)],
  },
  fighter: {
    groups: [
      group('armor', [option('chain', 'Кольчуга', [item('Кольчуга')]), option('leather_bow', 'Кожаный доспех, длинный лук и 20 стрел', [item('Кожаный доспех'), ...longbow])]),
      group('weapons', [
        option('shield', 'Воинское оружие и щит', [item('Щит')], [pick('weapons', 'Воинское оружие', MARTIAL_WEAPONS)]),
        option('two', 'Два воинских оружия', [], [pick('weapons', 'Воинское оружие', MARTIAL_WEAPONS, 2)]),
      ]),
      group('ranged', [option('crossbow', 'Лёгкий арбалет и 20 болтов', crossbow), option('handaxes', 'Два ручных топора', [item('Ручной топор', 2)])]),
      group('pack', [option('dungeoneer', 'Набор исследователя подземелий', [item('Набор исследователя подземелий')]), option('explorer', 'Набор путешественника', [item('Набор путешественника')])]),
    ],
    fixed: [],
  },
  monk: {
    groups: [
      group('weapon', [option('shortsword', 'Короткий меч', [item('Короткий меч')]), option('simple', 'Любое простое оружие', [], [pick('weapon', 'Оружие', SIMPLE_WEAPONS)])]),
      group('pack', [option('dungeoneer', 'Набор исследователя подземелий', [item('Набор исследователя подземелий')]), option('explorer', 'Набор путешественника', [item('Набор путешественника')])]),
    ],
    fixed: [item('Дротик', 10)],
  },
  paladin: {
    groups: [
      group('weapons', [
        option('shield', 'Воинское оружие и щит', [item('Щит')], [pick('weapons', 'Воинское оружие', MARTIAL_WEAPONS)]),
        option('two', 'Два воинских оружия', [], [pick('weapons', 'Воинское оружие', MARTIAL_WEAPONS, 2)]),
      ]),
      group('simple', [option('javelins', 'Пять метательных копий', [item('Метательное копьё', 5)]), option('simple_melee', 'Любое простое рукопашное оружие', [], [pick('weapon', 'Оружие', SIMPLE_MELEE)])]),
      group('pack', [option('priest', 'Набор священника', [item('Набор священника')]), option('explorer', 'Набор путешественника', [item('Набор путешественника')])]),
    ],
    fixed: [item('Кольчуга')],
    fixedPicks: [pick('holy_symbol', 'Священный символ', HOLY_SYMBOLS)],
  },
  ranger: {
    groups: [
      group('armor', [option('scale', 'Чешуйчатый доспех', [item('Чешуйчатый доспех')]), option('leather', 'Кожаный доспех', [item('Кожаный доспех')])]),
      group('weapons', [option('shortswords', 'Два коротких меча', [item('Короткий меч', 2)]), option('simple_melee', 'Два простых рукопашных оружия', [], [pick('weapons', 'Простое рукопашное оружие', SIMPLE_MELEE, 2)])]),
      group('pack', [option('dungeoneer', 'Набор исследователя подземелий', [item('Набор исследователя подземелий')]), option('explorer', 'Набор путешественника', [item('Набор путешественника')])]),
    ],
    fixed: longbowWithQuiver,
  },
  rogue: {
    groups: [
      group('weapon_1', [option('rapier', 'Рапира', [item('Рапира')]), option('shortsword', 'Короткий меч', [item('Короткий меч')])]),
      group('weapon_2', [option('shortbow', 'Короткий лук и колчан с 20 стрелами', shortbow), option('shortsword', 'Короткий меч', [item('Короткий меч')])]),
      group('pack', [
        option('burglar', 'Набор взломщика', [item('Набор взломщика')]),
        option('dungeoneer', 'Набор исследователя подземелий', [item('Набор исследователя подземелий')]),
        option('explorer', 'Набор путешественника', [item('Набор путешественника')]),
      ]),
    ],
    fixed: [item('Кожаная броня'), item('Кинжал', 2), item('Воровские инструменты')],
  },
  sorcerer: {
    groups: [
      group('weapon', [option('crossbow', 'Лёгкий арбалет и 20 болтов', crossbow), option('simple', 'Любое простое оружие', [], [pick('weapon', 'Оружие', SIMPLE_WEAPONS)])]),
      group('focus', [option('pouch', 'Мешочек с компонентами', [item('Мешочек с компонентами')]), option('focus', 'Магическая фокусировка', [], [pick('focus', 'Фокусировка', ARCANE_FOCI)])]),
      group('pack', [option('dungeoneer', 'Набор исследователя подземелий', [item('Набор исследователя подземелий')]), option('explorer', 'Набор путешественника', [item('Набор путешественника')])]),
    ],
    fixed: [item('Кинжал', 2)],
  },
  warlock: {
    groups: [
      group('weapon_1', [option('crossbow', 'Лёгкий арбалет и 20 болтов', crossbow), option('simple', 'Любое простое оружие', [], [pick('weapon', 'Оружие', SIMPLE_WEAPONS)])]),
      group('focus', [option('pouch', 'Мешочек с компонентами', [item('Мешочек с компонентами')]), option('focus', 'Магическая фокусировка', [], [pick('focus', 'Фокусировка', ARCANE_FOCI)])]),
      group('pack', [option('scholar', 'Набор учёного', [item('Набор учёного')]), option('dungeoneer', 'Набор исследователя подземелий', [item('Набор исследователя подземелий')])]),
      group('weapon_2', [option('simple', 'Любое простое оружие', [], [pick('weapon', 'Оружие', SIMPLE_WEAPONS)])]),
    ],
    fixed: [item('Кожаный доспех'), item('Кинжал', 2)],
  },
  wizard: {
    groups: [
      group('weapon', [option('staff', 'Боевой посох', [item('Боевой посох')]), option('dagger', 'Кинжал', [item('Кинжал')])]),
      group('focus', [option('pouch', 'Мешочек с компонентами', [item('Мешочек с компонентами')]), option('focus', 'Магическая фокусировка', [], [pick('focus', 'Фокусировка', ARCANE_FOCI)])]),
      group('pack', [option('scholar', 'Набор учёного', [item('Набор учёного')]), option('explorer', 'Набор путешественника', [item('Набор путешественника')])]),
    ],
    fixed: [item('Книга заклинаний')],
  },
}

const ALIASES = {
  barbarian: ['barbarian', 'варвар'],
  bard: ['bard', 'бард'],
  cleric: ['cleric', 'жрец'],
  druid: ['druid', 'друид'],
  fighter: ['fighter', 'воин'],
  monk: ['monk', 'монах'],
  paladin: ['paladin', 'паладин'],
  ranger: ['ranger', 'следопыт'],
  rogue: ['rogue', 'плут', 'разбойник'],
  sorcerer: ['sorcerer', 'чародей'],
  warlock: ['warlock', 'колдун'],
  wizard: ['wizard', 'волшебник'],
}

function normalized(value) {
  return String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е')
}

const CATALOGUE_ALIASES = {
  [normalized('Деревянный щит')]: normalized('Щит'),
  [normalized('Кожаная броня')]: normalized('Кожаный доспех'),
}

function catalogueKey(value) {
  const key = normalized(value)
  return CATALOGUE_ALIASES[key] || key
}

function equipmentEntry(entry) {
  const linked = entry?.item
  if (!linked) return { id: null, name: entry?.name || '', count: Math.max(1, Number(entry?.count) || 1) }
  return {
    id: linked.id,
    name: linked.name,
    count: Math.max(1, Number(entry?.count) || 1),
    typeId: linked.typeId,
    armor: linked.data?.armor,
  }
}

/** Resolve the PHB choice definitions to actual handbook rows used by the UI. */
export function resolveStartingEquipmentProfile(profile, catalogue = []) {
  if (!profile) return null
  const byName = new Map()
  for (const entry of catalogue) {
    if (!entry?.name) continue
    const key = catalogueKey(entry.name)
    const saved = byName.get(key)
    const score = (itemEntry) => (
      (itemEntry?.data?.available_in_starting_shop === true ? 4 : 0)
      + (Number(itemEntry?.typeId) === 12 ? 2 : 0)
      + (itemEntry?.iconImageUrl || itemEntry?.svg ? 1 : 0)
    )
    if (!saved || score(entry) > score(saved) || (score(entry) === score(saved) && Number(entry.id) < Number(saved.id))) {
      byName.set(key, entry)
    }
  }
  const resolveItem = (entry) => ({ ...entry, item: byName.get(catalogueKey(entry.name)) || null })
  return {
    ...profile,
    groups: profile.groups.map((groupDef) => ({
      ...groupDef,
      options: groupDef.options.map((optionDef) => ({
        ...optionDef,
        items: (optionDef.items || []).map(resolveItem),
        picks: (optionDef.picks || []).map((pickDef) => ({
          ...pickDef,
          options: pickDef.options
            .map((name) => byName.get(catalogueKey(name)))
            .filter(Boolean),
        })),
      })),
    })),
    fixed: (profile.fixed || []).map(resolveItem),
    fixedPicks: (profile.fixedPicks || []).map((pickDef) => ({
      ...pickDef,
      options: pickDef.options.map((name) => byName.get(catalogueKey(name))).filter(Boolean),
    })),
  }
}

export function startingEquipmentProfile(charClass) {
  const names = [charClass?.name, charClass?.nameEn]
  const normalizedNames = names.map(normalized).filter(Boolean)
  for (const [key, aliases] of Object.entries(ALIASES)) {
    if (aliases.some((alias) => normalizedNames.some((name) => name === alias || name.split(/[^a-zа-я]+/i).includes(alias)))) {
      return { key, ...PROFILES[key] }
    }
  }
  return null
}

function selectedOption(groupDef, choices) {
  const selectedId = choices?.[groupDef.id]?.optionId
  if (selectedId != null) return groupDef.options.find((entry) => entry.id === selectedId) || null
  return groupDef.options.length === 1 ? groupDef.options[0] : null
}

export function startingEquipmentComplete(profile, choices = {}) {
  if (!profile) return true
  const groupsComplete = profile.groups.every((groupDef) => {
    const selected = selectedOption(groupDef, choices)
    if (!selected) return false
    return (selected.picks || []).every((pickDef) => {
      const values = choices?.[groupDef.id]?.picks?.[pickDef.id] || []
      return Array.from({ length: pickDef.count }, (_, index) => {
        const saved = values[index]
        return pickDef.options.some((optionEntry) => (
          typeof optionEntry === 'string'
            ? optionEntry === saved
            : String(optionEntry.id) === String(saved) || optionEntry.name === saved
        ))
      }).every(Boolean)
    })
  })
  const fixedComplete = (profile.fixedPicks || []).every((pickDef) => {
    const values = choices?.__fixed?.picks?.[pickDef.id] || []
    return Array.from({ length: pickDef.count }, (_, index) => pickDef.options.some((optionEntry) => (
      typeof optionEntry === 'string'
        ? optionEntry === values[index]
        : String(optionEntry.id) === String(values[index]) || optionEntry.name === values[index]
    ))).every(Boolean)
  })
  return groupsComplete && fixedComplete
}

function pushItem(map, entry) {
  if (!entry?.name) return
  const key = entry.id != null ? `id:${entry.id}` : `name:${normalized(entry.name)}`
  const saved = map.get(key)
  if (saved) saved.count += Math.max(1, Number(entry.count) || 1)
  else map.set(key, { ...entry, id: entry.id ?? null, count: Math.max(1, Number(entry.count) || 1) })
}

export function selectedStartingEquipment(profile, choices = {}) {
  if (!profile) return []
  const merged = new Map()
  ;(profile.fixed || []).forEach((entry) => pushItem(merged, equipmentEntry(entry)))
  for (const pickDef of (profile.fixedPicks || [])) {
    const values = choices?.__fixed?.picks?.[pickDef.id] || []
    values.filter(Boolean).forEach((saved) => {
      const optionEntry = pickDef.options.find((entry) => (
        typeof entry === 'string' ? entry === saved : String(entry.id) === String(saved) || entry.name === saved
      ))
      if (typeof optionEntry === 'string') pushItem(merged, item(optionEntry))
      else if (optionEntry) pushItem(merged, equipmentEntry({ item: optionEntry }))
    })
  }
  for (const groupDef of profile.groups) {
    const selected = selectedOption(groupDef, choices)
    if (!selected) continue
    ;(selected.items || []).forEach((entry) => pushItem(merged, equipmentEntry(entry)))
    for (const pickDef of (selected.picks || [])) {
      const values = choices?.[groupDef.id]?.picks?.[pickDef.id] || []
      values.filter(Boolean).forEach((saved) => {
        const optionEntry = pickDef.options.find((entry) => (
          typeof entry === 'string'
            ? entry === saved
            : String(entry.id) === String(saved) || entry.name === saved
        ))
        if (typeof optionEntry === 'string') pushItem(merged, item(optionEntry))
        else if (optionEntry) pushItem(merged, equipmentEntry({ item: optionEntry }))
      })
    }
  }
  return [...merged.values()]
}

export function mergeEquipment(...lists) {
  const merged = new Map()
  for (const entry of lists.flat()) {
    if (!entry?.name) continue
    const key = entry.id != null ? `id:${entry.id}` : `name:${normalized(entry.name)}`
    const saved = merged.get(key)
    if (saved) saved.count += Math.max(1, Number(entry.count) || 1)
    else merged.set(key, { ...entry, id: entry.id ?? null, count: Math.max(1, Number(entry.count) || 1) })
  }
  return [...merged.values()]
}

export const STARTING_EQUIPMENT_CLASS_KEYS = Object.keys(PROFILES)
