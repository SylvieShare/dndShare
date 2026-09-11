// Storage fields stay in the handbook schema; this manifest describes authoring.
const select = (name, options, hint) => ({ type: 'select', numeric: options.every(([value]) => typeof value === 'number'), name, options: options.map(([value, label]) => ({ value, label })), hint })
export const rollScopes = [['ability_check', 'Проверки характеристик'], ['saving_throw', 'Спасброски'], ['attack', 'Атаки'], ['initiative', 'Инициатива']]
const rank = select('Владение', [[1, 'Владение'], [2, 'Компетентность — двойной бонус']], 'Какой бонус мастерства применять.')
rank.default = 1
const scopeField = { type: 'enum_array', name: 'Какие броски', options: rollScopes.map(([value, label]) => ({ value, label })), hint: 'Пустой список означает все броски.' }
const armorKinds = ['armor_formula', 'armor_bonus', 'speed_bonus', 'weapon_attack_bonus', 'weapon_damage_bonus', 'roll_mode']
export const derivedKinds = {
  armor_formula: ['base', 'ability_ids', 'allow_shield'], armor_bonus: ['value'], speed_bonus: ['value'],
  skill_proficiency: ['rank'], save_proficiency: ['rank'], tool_proficiency: ['rank'],
  weapon_proficiency: ['rank'], armor_proficiency: ['rank'], language_proficiency: ['rank'],
  check_bonus: ['value'], skill_bonus: ['value'], save_bonus: ['value'], weapon_attack_bonus: ['value', 'weapon_kind'],
  weapon_damage_bonus: ['value', 'weapon_kind'], critical_threshold: ['value', 'weapon_kind'],
  roll_mode: ['mode', 'scopes'], activity_block: ['scopes'],
}
const bonusKinds = ['check_bonus', 'skill_bonus', 'save_bonus', 'weapon_attack_bonus', 'weapon_damage_bonus']
export const dependencyManifest = {
  derived_effects: {
    main: data => ['kind', ...(derivedKinds[data.kind] || [])],
    fields: {
      kind: { name: 'Что изменить' }, rank,
      value: { name: 'Величина', hint: 'Прибавка к показателю; для порога критического попадания — минимальное значение на к20.' },
      base: { name: 'Основа КД', hint: 'К этой основе прибавятся модификаторы выбранных характеристик.' },
      ability_ids: { type: 'suggest_array', suggest_id: 16, name: 'Характеристики', hint: 'Для КД складываются модификаторы. Для бросков ограничивает действие выбранными характеристиками.' },
      scopes: scopeField, minimum: { type: 'int', name: 'Минимальная прибавка' },
      only_without_proficiency: { name: 'Только без владения' },
      target_from_choice: { name: 'Применять к выбранным игроком вариантам' },
      choice_values: { name: 'Только выбранные варианты', hint: 'Без ограничения подходят любые ответы игрока.' },
      group: { name: 'Группа заменяющих бонусов', hint: 'В одной группе применяется наибольший бонус скорости, а не сумма. Одинаковое имя объединяет правила.' },
      value_parameter: { name: 'Название параметра величины', hint: 'Источник эффекта сможет передать своё значение под этим именем. Без параметра действует указанная величина.' },
      target_parameter: { name: 'Название параметра цели', hint: 'Источник эффекта передаёт выбранную цель, например оружие, под этим именем.' },
    },
    gates: [
      { title: 'Добавить характеристику или мастерство', keys: ['ability_modifier', 'proficiency_multiplier', 'minimum'], when: d => bonusKinds.includes(d.kind) },
      { title: 'Зависит от выбора игрока', keys: ['choice_key', 'target_from_choice', 'choice_values', 'choice_value_prefix'] },
      { title: 'Ограничить характеристики', keys: ['ability_ids'], when: d => ['save_proficiency', 'save_bonus', 'roll_mode', 'check_bonus'].includes(d.kind) && d.kind !== 'armor_formula' },
      { title: 'Только без владения', keys: ['only_without_proficiency'], when: d => bonusKinds.includes(d.kind) },
      { title: 'Условия по снаряжению', keys: ['requires_armor', 'requires_no_armor', 'forbid_heavy_armor', 'allow_shield'], when: d => armorKinds.includes(d.kind) },
      { title: 'Своя подпись правила', keys: ['label'] },
      { title: 'Величину задаёт источник эффекта', keys: ['value_parameter'], when: d => (derivedKinds[d.kind] || []).includes('value') },
      { title: 'Цель задаёт источник эффекта', keys: ['target_parameter'], when: d => ['weapon_attack_bonus', 'weapon_damage_bonus'].includes(d.kind) },
      { title: 'Заменяет меньший бонус скорости', keys: ['group'], when: d => d.kind === 'speed_bonus' },
    ],
  },
  granted_spells: {
    main: () => ['spell', 'ability', 'slotless', 'counts_as_known'],
    fields: { ability: { name: 'Характеристика заклинания' }, counts_as_known: { name: 'Занимает место среди известных заклинаний' }, slotless: { name: 'Можно сотворять без ячейки' } },
    gates: [{ title: 'Сотворять на другом уровне', keys: ['cast_level'] }],
  },
  roll_triggers: { main: () => ['event', 'scopes', 'label'], fields: { scopes: scopeField, label: { name: 'Название предложения перебросить' } }, gates: [], summary: d => d.event === 'any' ? 'После броска можно выбрать переброс. Второй результат обязателен.' : 'При натуральной 1 на к20 предложить переброс.' },
  roll_adjustments: {
    main: () => ['value', 'scope', 'minimum_proficiency_rank'],
    fields: { value: { name: 'Минимум на к20' }, scope: { name: 'Для каких бросков' }, minimum_proficiency_rank: select('Условие владения', [[0, 'Не требуется'], [1, 'Есть владение или компетентность'], [2, 'Есть компетентность']]) },
    gates: [], summary: d => `Значения на к20 ниже ${d.value || 10} считаются равными ${d.value || 10}.`,
  },
  critical_damage: { main: () => ['extra_weapon_dice', 'weapon_kind'], fields: { extra_weapon_dice: { name: 'Дополнительных костей оружия' }, weapon_kind: { name: 'Для какого оружия' } }, gates: [], summary: () => 'Добавляются при критическом попадании сверх обычного критического урона.' },
  hp_bonuses: { main: () => ['title'], fields: { base: { name: 'Постоянная прибавка' }, per_level: { name: 'Хитов за каждый уровень' } }, gates: [{ title: 'Постоянная прибавка', keys: ['base'] }, { title: 'Прибавка за уровень', keys: ['per_level'] }] },
  defenses: { main: () => ['kind', 'damage_type'], gates: [] },
  passive_effects: { main: () => ['title', 'description', 'tone'], gates: [], summary: () => 'Памятка на листе. Автоматические изменения задаются отдельными зависимостями.' },
}
export function dependencyFields(kind, fields, keys, data = {}) {
  const overrides = dependencyManifest[kind]?.fields || {}
  return keys.map(key => {
    const field = { ...fields.find(f => f.key === key), ...overrides[key], key }
    if (key === 'scopes' && kind === 'derived_effects') {
      const scopes = data.kind === 'activity_block' ? [['spellcasting', 'Сотворение заклинаний'], ['concentration', 'Концентрация']] : [...rollScopes, ['skill_check', 'Проверки навыков'], ['tool', 'Проверки инструментов']]
      field.options = scopes.map(([value, label]) => ({ value, label }))
      if (data.kind === 'activity_block') field.name = 'Что запретить'
    }
    return field
  }).filter(f => f.type)
}
export function changeDerivedKind(data, kind) {
  const allSpecific = new Set([...Object.values(derivedKinds).flat(), 'target_ids', 'skill_ids', 'choice_value_prefix'])
  const allowed = new Set([...(derivedKinds[kind] || []), ...dependencyManifest.derived_effects.gates.filter(g => !g.when || g.when({ kind })).flatMap(g => g.keys)])
  for (const key of allSpecific) if (!allowed.has(key)) delete data[key]
  for (const gate of dependencyManifest.derived_effects.gates) {
    if (gate.when && !gate.when({ kind })) for (const key of gate.keys) if (!allowed.has(key)) delete data[key]
  }
  data.kind = kind
}
