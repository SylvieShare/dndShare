// Composition belongs to the fixed catalogue types; schemas remain the storage contract.
const group = (key, name, keys, optional = false) => ({ key, name, keys: keys.split(' '), optional })
const economy = group('economy', 'Цена и учёт', 'cost weight available_in_starting_shop')
const proficiencies = group('proficiencies', 'Владения и языки', 'skill_prof languages armor_prof weapon_prof tool_prof', true)
const raceGroups = [
  group('body', 'Размер и передвижение', 'size speed'),
  group('abilities', 'Бонусы характеристик', 'asi asi_choice', true), proficiencies,
  group('choices', 'Выборы при создании', 'skill_choice lang_choice feat_choice', true),
  group('variants', 'Варианты расы', 'variants', true),
]
const classGroups = [
  group('base', 'Основы класса', 'hit_die primary_abilities saves subclass_level asi_levels'),
  group('proficiencies', 'Владения', 'armor_prof weapon_prof tool_prof skill_choice tool_prof_choice', true),
  group('magic', 'Заклинательство', 'caster_progression spellcasting spellcasting_ability', true),
  group('spells', 'Дарованные заклинания', 'granted_spells', true),
  group('resources', 'Общие ресурсы класса', 'class_resources', true),
  group('equipment', 'Стартовое снаряжение', 'starting_equipment', true),
]
export const catalogueProfiles = {
  19: { title: 'Магический предмет', primary: ['desc', 'type', 'rarity', 'attunement', 'attunement_requirement', 'activation'], groups: [group('economy', 'Цена, вес и использование', 'cost weight consumable recharge_note available_in_starting_shop'), group('storage', 'Хранение и содержимое', 'is_container contents equipment_category measurement unit_cost_copper unit_weight'), group('armor', 'Доспех или щит', 'armor category required_armor_proficiency strength_required stealth_disadvantage')] },
  1: { title: 'Оружие', primary: ['notes'], groups: [group('weapon', 'Вид и свойства', 'is_military is_long_range tags required_weapon_proficiencies'), group('damage', 'Урон и дистанция', 'attacks universe_attacks range_min range_max'), economy] },
  2: { title: 'Предмет', primary: ['desc'], groups: [group('kind', 'Назначение', 'equipment_category rarity is_container consumable measurement unit_cost_copper unit_weight'), economy, group('pack', 'Содержимое набора', 'contents', true), group('armor', 'Правило защиты', 'armor', true)] },
  5: { title: 'Заклинание', primary: ['lvl', 'schoolId', 'description', 'classes'], groups: [group('casting', 'Сотворение', 'time range duration concentration ritual components'), group('damage', 'Урон', 'damage', true), group('healing', 'Лечение', 'heal', true), group('effects', 'Накладываемые эффекты', 'status_effects', true)] },
  6: { title: 'Существо', primary: ['identity', 'description', 'tags'], groups: [group('combat', 'Параметры боя', 'combat stats'), group('saves', 'Спасброски и навыки', 'saving_throws skills', true), group('senses', 'Чувства и языки', 'senses languages', true), group('defenses', 'Сопротивления и иммунитеты', 'damage_immunities damage_resistances condition_immunities', true), group('feats', 'Особенности', 'feats', true), group('actions', 'Действия', 'actions', true), group('reactions', 'Реакции', 'reactions', true)] },
  8: { title: 'Раса', primary: ['short_description', 'description'], groups: raceGroups },
  9: { title: 'Класс', primary: ['short_description', 'description'], groups: classGroups },
  10: { title: 'Зелье', primary: ['desc'], groups: [group('potion', 'Свойства зелья', 'rarity color'), economy] },
  11: { title: 'Предыстория', primary: ['description', 'feature', 'feature_desc'], groups: [group('grants', 'Владения и языки', 'skills languages lang_choice tool_prof'), group('equipment', 'Стартовое снаряжение', 'tool_items equipment_items starting_coins', true), group('choices', 'Снаряжение на выбор', 'item_choices', true)] },
  12: { title: 'Доспех', primary: ['desc'], groups: [group('armor', 'Защита', 'category required_armor_proficiency armor'), group('limits', 'Ограничения', 'strength_required stealth_disadvantage'), economy] },
  13: { title: 'Транспорт', primary: ['desc', 'category', 'tack_kind', 'creature_item_id'], groups: [group('movement', 'Передвижение', 'movement propulsion', true), group('capacity', 'Вместимость', 'capacity', true), group('combat', 'Прочность', 'vehicle_stats', true), group('tack', 'Свойства снаряжения', 'rider_stability_advantage for_exotic_mount'), economy] },
  14: { title: 'Инструмент', primary: ['desc'], groups: [group('tool', 'Назначение и владение', 'category required_tool_proficiencies rarity is_container'), economy] },
  15: { title: 'Эффект', primary: ['code', 'desc', 'thesis'], groups: [group('effect', 'Применение эффекта', 'polarity color stacking duration concentration'), group('rules', 'Изменения показателей', 'derived_effects', true), group('defenses', 'Защиты', 'defenses', true), group('levels', 'Ступени эффекта', 'level max_level', true)] },
  16: { title: 'Подраса', primary: ['race', 'short_description', 'description'], groups: raceGroups },
  17: { title: 'Подкласс', primary: ['class', 'short_description', 'description'], groups: classGroups },
}

export function catalogueProfile(typeId, fields) {
  const profile = catalogueProfiles[typeId] || { title: 'Объект', primary: ['description', 'desc'], groups: [] }
  const editable = fields.filter(f => !f.readonly)
  const pick = keys => keys.map(key => editable.find(f => f.key === key)).filter(Boolean)
  const groups = profile.groups.map(g => ({ ...g, fields: pick(g.keys) })).filter(g => g.fields.length)
  const used = new Set([...profile.primary, ...groups.flatMap(g => g.keys)])
  const other = editable.filter(f => !used.has(f.key))
  if (other.length) groups.push({ key: 'extra', name: 'Дополнительные настройки', fields: other, optional: true })
  return { title: profile.title, primary: pick(profile.primary), groups }
}
