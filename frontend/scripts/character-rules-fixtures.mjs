import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Execute the actual pure web rules. Fixtures are also consumed by Kotlin tests.
const root = fileURLToPath(new URL('..', import.meta.url))
const output = fileURLToPath(new URL('../../native/fixtures/character-rules.json', import.meta.url))
const server = await createServer({ root, configFile: false, logLevel: 'error',
  resolve: { alias: { '@': path.join(root, 'src') } }, server: { middlewareMode: true } })
try {
  const rules = await server.ssrLoadModule('/src/features/character-editor/blocks/dnd/lib/rest.js')
  const cases = []
  for (const version of ['2014', '2024']) {
    for (const recovery of [null, { d8: 1, d10: 2 }, { d8: 0, d10: 0 }]) {
      const hp = { max: { base: 24, bonuses: [{ value: 3 }] }, current: 2, temp: 8,
        hitDice: [{ die: 'd8', total: 3, used: 2 }, { die: 'd10', total: 2, used: 2 }], ds_success: 1, ds_failure: 2 }
      cases.push({ name: `long-${version}-${cases.length}`, kind: 'longHp', version, hp, recovery,
        expected: rules.longRestHp(hp, recovery, version) })
    }
  }
  for (const die of ['d8', 'd10']) {
    for (const amount of [0, 5, 100]) {
      const hp = { max: { base: 20, bonuses: [] }, current: 7,
        hitDice: [{ die: 'd8', total: 3, used: 1 }, { die: 'd10', total: 2, used: 0 }] }
      cases.push({ name: `spend-${die}-${amount}`, kind: 'spendHp', hp, die, amount, expected: rules.spendHitDie(hp, amount, die) })
    }
  }
  const spells = { schema_version: 2, tabs: [], grants: [], slot_pools: {
    long_rest: [{ level: 1, total: 4, used: 3 }], short_rest: [{ level: 3, total: 2, used: 2 }] } }
  for (const kind of ['short', 'long']) cases.push({ name: `slots-${kind}`, kind: 'slots', rest: kind, spells,
    expected: kind === 'long' ? rules.longRestSpells(spells) : rules.shortRestSpells(spells) })
  const assembler = await server.ssrLoadModule('/src/features/character-editor/settings/dnd/creation/buildCharacter.js')
  for (const version of ['2014', '2024']) {
    const race = { id: 81, typeId: 8, name: 'Происхождение', data: { speed: 35, asi: [{ ability: 1, bonus: 2 }], languages: [1], skill_prof: [1] } }
    const charClass = { id: 91, typeId: 9, name: 'Класс', nameEn: 'Fighter', data: { hit_die: 'd10', saves: [1, 3], weapon_prof: [2], armor_prof: [3] } }
    const background = { id: 111, typeId: 11, name: 'Предыстория', data: { skills: [5], languages: [2], ability_options: [1, 2, 3] } }
    const input = { name: 'Тестовый герой', rulesVersion: version, race: { id: race.id, name: race.name, item: race },
      charClass: { id: charClass.id, name: charClass.name, item: charClass }, background: { id: background.id, name: background.name, item: background },
      scores: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 }, skillIds: [2],
      backgroundAsi: version === '2024' ? { DEX: 2, CON: 1 } : {}, suggestValue: (type, id) => `label-${type}-${id}` }
    const expected = assembler.buildCharacterData(input).data.values
    const keys = ['name', 'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA', 'hp', 'speed', 'proficiencies', 'classes', 'background', 'person_origin']
    cases.push({ name: `creation-${version}`, kind: 'creation', version, catalogue: [race,charClass,background],
      expected: Object.fromEntries(keys.map(key => [key, expected[key]])) })
  }
  const advancement = await server.ssrLoadModule('/src/features/character-editor/blocks/dnd/components/buildLevelUpUpdates.js')
  for (const scenario of ['fighter-asi', 'pact-upgrade', 'racial-spell']) {
    const pact = scenario === 'pact-upgrade'
    const level = pact ? 2 : scenario === 'fighter-asi' ? 3 : 2
    const charClass = { id: 91, typeId: 9, name: pact ? 'Колдун' : 'Воин', nameEn: pact ? 'Warlock' : 'Fighter',
      data: { hit_die: pact ? 'd8' : 'd10', ...(pact ? { caster_progression: 'pact', spellcasting: { ability: 6, list_class: 91, selection_mode: 'known' } } : {}) } }
    const raceAbility = { id: 4087, typeId: 3, name: 'Дроуская магия', data: { granted_spells: [{ spell: 511, level: 1, ability: 6 }, { spell: 627, level: 3, ability: 6, slotless: true }] } }
    const values = { lvl: { level, exp: 700 }, classes: [{ id: 91, name: charClass.name, level, subclass: null }],
      STR: { value: { base: 14, bonuses: [] } }, CON: { value: { base: 14, bonuses: [] } },
      hp: { max: { base: 20, bonuses: [] }, current: 13, hitDice: [{ die: pact ? 'd8' : 'd10', total: level, used: 1 }], history: [] },
      abilities_class: [], ...(scenario === 'racial-spell' ? { abilities_race: [{ id: 4087 }] } : {}),
      spells: { schema_version: 2, tabs: [], grants: [], slot_pools: { long_rest: [], short_rest: pact ? [{ level: 1, total: 2, used: 1 }] : [] } } }
    const items = [charClass, ...(scenario === 'racial-spell' ? [raceAbility] : [])]
    const input = { advance: true, exp: 700, classId: 91, asiMode: scenario === 'fighter-asi' ? 'stats' : 'skip', asi: { STR: 2 } }
    const result = advancement.buildLevelUpUpdates({ values, newTotal: level + 1, entriesAfter: [{ ...values.classes[0], level: level + 1 }],
      features: [], itemsById: Object.fromEntries(items.map(item => [item.id, item])), classItem: charClass,
      hitDieLabelOf: item => item.data.hit_die, hitDieLabel: charClass.data.hit_die, hpGain: (pact ? 5 : 6) + 2,
      asiNow: scenario === 'fighter-asi', asiSkipped: scenario !== 'fighter-asi', asiMode: 'asi', asiStats: ['STR'], asiDelta: 2,
      suggestItems: () => [], featureChoiceSelections: {}, grantedNewIds: [],
      slotChanges: pact ? [{ kind: 'upgraded', pact: true, fromLevel: 1, level: 2, count: 2 }] : [] })
    const keys = ['lvl', 'classes', 'hp', ...(scenario === 'fighter-asi' ? ['STR'] : []), ...(scenario === 'racial-spell' ? ['spells'] : [])]
    // The native client materializes a class tab when casting starts; compare pools separately.
    if (pact) keys.push('spells')
    const expected = Object.fromEntries(keys.map(key => [key, result[key]]))
    if (pact) expected.spells = { slot_pools: result.spells.slot_pools }
    cases.push({ name: scenario, kind: 'advancement', version: '2014', catalogue: items, values, input, expected })
  }
  const { ref } = await import('vue')
  const weaponCalc = await server.ssrLoadModule('/src/features/character-editor/blocks/dnd/composables/useWeaponCalc.js')
  const weaponAbility = await server.ssrLoadModule('/src/features/character-editor/blocks/dnd/lib/weaponAbility.js')
  const magicWeapons = await server.ssrLoadModule('/src/features/character-editor/lib/magicWeapons.js')
  const proficiency = await server.ssrLoadModule('/src/features/character-editor/lib/itemProficiency.js')
  const derivedRules = await server.ssrLoadModule('/src/features/character-editor/lib/characterDerivedEffects.js')
  const combatRules = await server.ssrLoadModule('/src/features/character-editor/lib/characterCombatEffects.js')
  const throwRules = await server.ssrLoadModule('/src/features/character-editor/blocks/dnd/lib/weaponThrow.js')
  for (const scenario of ['finesse', 'ranged', 'magical', 'unattuned', 'off-weapon', 'natural-throw', 'improvised-throw', 'finesse-equal-mod']) {
    const blade = { id: 1001, name: 'Клинок', typeId: 1, data: { attacks: [{ count: 1, dice_id: 'd8', type: 1 }], universe_attacks: [{ count: 1, dice_id: 'd10', type: 1 }], tags: ['finesse'], required_weapon_proficiencies: [2] } }
    const magic = { id: 1002, name: 'Магический клинок', typeId: 19, data: { weapon: { base_item_id: 1001, magic_bonus: 2 }, attunement: scenario === 'unattuned' ? 'required' : 'none', derived_effects: [{ kind: 'weapon_attack_bonus', value: 1 }, { kind: 'critical_threshold', value: 19 }] } }
    const feat = { id: 1003, name: 'Боевой стиль', typeId: 7, data: { derived_effects: [{ kind: 'weapon_damage_bonus', value: 2, weapon_kind: 'ranged', weapon_attacks_only: true }, { kind: 'weapon_attack_bonus', value: 2, ability_ids: [1], weapon_attacks_only: true }], critical_damage: [{ extra_weapon_dice: 1, weapon_kind: 'melee' }] } }
    if (scenario === 'ranged') blade.data.is_long_range = true
    if (scenario === 'natural-throw') blade.data.tags.push('thrown')
    const magical = ['magical', 'unattuned', 'off-weapon'].includes(scenario)
    const entry = { uid: 'blade', item_id: 1001, proficient: false, params: { magic_bonus: 1 }, add_attacks: [{ count: 1, dice_id: 'd4', type_suggest_id: 2 }] }
    if (magical && scenario !== 'off-weapon') entry.magic_item_id = 1002
    const values = { lvl: { level: 5 }, STR: { value: { base: 14, bonuses: [] } }, DEX: { value: { base: scenario === 'finesse-equal-mod' ? 15 : 18, bonuses: [] } }, prof_bonus: { auto: true, v: 2, bonuses: [] }, proficiencies: { 'Оружие': ['Воинское оружие'] }, abilities_feats: [{ id: 1003 }], weapon: [entry], items: { equipped: [], sections: [] } }
    if (scenario === 'off-weapon') values.weapon.push({ uid: 'other-magic', item_id: 1001, magic_item_id: 1002, params: {}, proficient: true })
    const catalogue = [blade, magic, feat]
    const items = Object.fromEntries(catalogue.map(item => [item.id, item]))
    const itemMap = new Map(catalogue.map(item => [String(item.id), item]))
    const metadata = { suggests: { '4': [{ id: 2, typeId: 4, value: 'Воинское оружие' }], '12': [{ id: 1, typeId: 12, value: 'Колющий' }, { id: 2, typeId: 12, value: 'Холод' }] } }
    const thrown = ['natural-throw', 'improvised-throw'].includes(scenario)
    const resolved = magicWeapons.resolveWeaponItem(entry, items)
    const properties = resolved.data.tags
    const prepared = thrown ? throwRules.prepareWeaponRollEntry(entry, resolved, properties, [{ key: 'throw', attack_mode: 'thrown' }], ['throw']) : entry
    const stats = weaponAbility.abilityModifiersBySuggest(values)
    const context = { kind: 'attack', abilitySuggestId: weaponAbility.weaponAbilitySuggestId(prepared, resolved, properties, stats), targetId: entry.uid, weaponAttack: true, weaponKind: thrown || resolved.data.is_long_range ? 'ranged' : 'melee', improvisedWeapon: !!prepared._improvisedThrow }
    const effects = derivedRules.collectCharacterDerivedEffects(values, itemMap)
    const combat = combatRules.collectCharacterCombatEffects(values, itemMap)
    const calc = weaponCalc.useWeaponCalc({ statsVar: ref(stats), profBonus: ref(3), diceMap: ref(Object.fromEntries([4,6,8,10,12,20,100].map(sides => [`d${sides}`, `d${sides}`]))), diceDetailsMap: ref({}), damageTypeMap: ref({ 1: 'Колющий', 2: 'Холод' }), damageTypeDetailsMap: ref({}), item: () => resolved, propertyItems: () => properties, itemBaseAttacks: () => resolved.data.attacks || [], itemTwoHandedAttacks: () => resolved.data.universe_attacks || [], isProficient: row => row.proficient || proficiency.hasItemProficiency(resolved, values, type => metadata.suggests[type] || []), magicBonusModifier: row => magicWeapons.intrinsicWeaponBonus(row, resolved, values), damageBonusModifier: () => derivedRules.derivedNumericBonus(effects, 'weapon_damage_bonus', values, context).total })
    const extra = prepared._improvisedThrow ? 0 : combatRules.extraCriticalWeaponDice(combat, { weaponUid: entry.uid, melee: context.weaponKind === 'melee' })
    const plain = expression => expression.replace(/\{[^}]*\}/g, '')
    const expected = { attack: calc.attackBonus(prepared) + derivedRules.derivedNumericBonus(effects, 'weapon_attack_bonus', values, context).total, damageBonus: calc.damageBonus(prepared), expression: plain(calc.damageExpression(prepared)), critical: plain(calc.criticalDamageExpression(prepared, extra)), threshold: derivedRules.derivedCriticalThreshold(effects, context), ability: context.abilitySuggestId }
    cases.push({ name: scenario, kind: 'weapon', catalogue, values, entry, thrown, metadata, expected })
  }

  const diceRules = await server.ssrLoadModule('/src/shared/lib/dice.js')
  for (const formula of ['2d6+3', '1к8−1', '2d4{Огонь|#ef4444}+3{Огонь|#ef4444}+1d6{Холод}', '1d6*2+1d4−3', '2D6 × 2{Холод}', '-1d4+10']) {
    let draw = 0
    cases.push({ name: `dice-${formula}`, kind: 'dice', formula, expected: diceRules.rollDiceExpression(formula, sides => (++draw % sides) + 1) })
  }
  const stockRules = await server.ssrLoadModule('/src/shared/lib/itemInitialCharges.js')
  const stocks = [
    { name: 'fixed', data: { initial_charges: { mode: 'fixed', value: 3 } }, previous: {}, proposed: {}, values: { '': 3 } },
    { name: 'rolled', data: { initial_charges: { mode: 'roll', formula: '1d4-1' } }, previous: {}, proposed: { magic: { max_use: 2 } }, values: { '': 2 } },
    { name: 'empty-immutable', data: { initial_charges: { mode: 'roll', formula: '1d4-1' } }, previous: { magic: { max_use: 0, remaining: 0 } }, proposed: { magic: { max_use: 99, remaining: 0 } }, values: { '': 99 } },
    { name: 'separate-pools', data: { use_resources: [{ key: 'a', title: 'Первый', initial_charges: { mode: 'fixed', value: 2 } }, { key: 'b', title: 'Второй', initial_charges: { mode: 'roll', formula: '1d4-1' } }] }, previous: { magic: { resource_maxima: { a: 2 }, resource_counts: { a: 1 } } }, proposed: { magic: { resource_maxima: { a: 99, b: 0 }, resource_counts: { a: 1 } } }, values: { a: 99, b: 0 } },
  ]
  for (const scenario of stocks) {
    let expected = scenario.previous
    for (const stock of stockRules.initialChargeStocks(scenario.data)) expected = stockRules.initializeItemCharges(expected, scenario.values[stock.key], stock.key)
    cases.push({ name: `stocks-${scenario.name}`, kind: 'stocks', data: scenario.data, previous: scenario.previous, proposed: scenario.proposed, expected })
  }

  const calculationRules = await server.ssrLoadModule('/src/shared/lib/richCalculation.js')
  for (const [formula, context] of [
    ['2+3*4', {}], ['max(1, casting_mod)', {}], ['max(1, casting_mod)', { casting_mod: { value: 4 } }],
    ['floor(char_level/2)+ceil(prof_bonus/2)', { char_level: { value: 5 }, prof_bonus: { value: 3 } }],
    ['min(str_mod, dex_mod, 10)', { str_mod: { value: -1 }, dex_mod: { value: 4 } }],
    ['-2×(3+1)', {}], ['1/0', {}], ['floor(2,3)', {}],
  ]) cases.push({name: `formula-${formula}`, kind: 'richFormula', formula, context, expected: calculationRules.calculateRichFormula(formula, context)})

  const widgets = await server.ssrLoadModule('/src/features/character-editor/lib/characterFeatureWidgets.js')
  const resources = await server.ssrLoadModule('/src/features/character-editor/lib/characterResources.js')
  for (const scenario of ['rage-manual', 'sneak', 'missing-class', 'two-magic', 'note-merge']) {
    const rage = {id: 10, typeId: 4, name: 'Ярость', data: {max_use: 3, scaling: [{level: 1, value: '+2'}], status_effects: [{key: 'rage', effect: {id: 100}}], sheet_widgets: [{key: 'rage', kind: 'toggle', value_source: 'scaling', status_effect_key: 'rage'}]}}
    const effect = {id: 100, typeId: 15, name: 'Ярость', data: {}}
    const values = {lvl: {level: 5}, classes: [{id: 11, level: 5}], abilities_class: [{id: 10, uid: 'rage', count: 2}], states: [{uid: 'manual-rage', effect_id: 100, source: {kind: 'manual'}}]}
    const catalogue = [rage, effect]
    if (scenario === 'sneak' || scenario === 'missing-class') {
      rage.data = {class_ids: [scenario === 'missing-class' ? 12 : 11], weapon_damage: [{key: 'sneak', dice: 'd6', dice_count_level_divisor: 2}], sheet_widgets: [{key: 'sneak_attack', title: 'Скрытая атака', kind: 'metric', value_source: 'weapon_damage', weapon_damage_key: 'sneak'}]}
    }
    if (scenario === 'two-magic') {
      rage.typeId = 19; rage.data.attunement = 'none'; delete rage.data.status_effects
      values.abilities_class = []; values.states = []
      values.items = {equipped: [{uid: 'first', item_id: 10, count: 1, params: {magic: {remaining: 1}}}, {uid: 'second', item_id: 10, count: 1, params: {magic: {remaining: 3, widget_states: {rage: true}}}}], sections: []}
    }
    if (scenario === 'note-merge') {
      rage.data.sheet_widgets = [{key: 'shared', title: 'Показатель', kind: 'metric', value: '3', priority: 2}]
      const note = {id: 20, typeId: 7, name: 'Пояснение', data: {sheet_widgets: [{key: 'shared', kind: 'note', title: 'Условие', priority: 1}]}}
      catalogue.push(note); values.abilities_feats = [{id: 20}]
    }
    const map = new Map(catalogue.map(item => [String(item.id), item]))
    const expected = widgets.collectCharacterFeatureWidgets(values, map, resources.collectCharacterResources(values, map)).map(row => ({key: row.key, title: row.title, kind: row.kind, value: row.value, active: row.active, unavailable: row.unavailable, resource: row.resource ? {value: row.resource.value, total: row.resource.total} : null, notes: row.notes.map(note => note.title)}))
    cases.push({name: `widget-${scenario}`, kind: 'widget', values, catalogue, expected})
  }
  const selections = await server.ssrLoadModule('/src/features/character-editor/lib/selectedAbilities.js')
  for (const scenario of ['unlocked', 'ability', 'choice', 'missing-spell']) {
    const parent = {id: 101, typeId: 4, name: 'Набор', data: {class_ids: [11], level: 1, ability_selection: {counts: [{level: 1, count: 1}, {level: 3, count: 2}], replace_count: 1, replace_levels: [3]}}}
    const item = {id: 102, typeId: 4, name: 'Выбор', data: {selection_parent_id: 101, level: 2}}
    const values = {lvl: {level: 3}, classes: [{id: 11, level: 3}], abilities_class: [{id: 101, choices: {focus: ['arcane']}}, {id: 5}], spells: {tabs: [{spells: [{id: 9}]}], grants: []}}
    if(scenario === 'ability') item.data.selection_requirements = {abilities: [{id: 5, name: 'Основы'}]}
    if(scenario === 'choice') item.data.selection_requirements = {choices: [{item_id: 101, key: 'focus', values: ['arcane']}]}
    if(scenario === 'missing-spell') item.data.selection_requirements = {spells: [{id: 99, name: 'Недоступное'}]}
    cases.push({name: `selection-${scenario}`, kind: 'selection', values, parent, item, expected: {count: selections.abilitySelectionCount(parent, 3), replacements: selections.abilityReplacementCount(parent, values), eligible: selections.selectedAbilityEligibility(item, parent, values).eligible}})
  }

  const actionRules = await server.ssrLoadModule('/src/features/character-editor/lib/characterFeatureActions.js')
  for(const scenario of ['manual', 'feature', 'blocked-status']) {
    const item = {id: 20, typeId: 4, name: 'Воинская магия', data: {max_use: 2, feature_actions: [{key: 'storm', title: 'Гроза', action_type: 'bonus_action', description: '<p>Наложить на оружие</p>', required_status_codes: ['rage'], uses_resource: true, resource_cost: 1, target_kind: 'weapon', status_effect_code: 'flame', menu_effects: [{key: 'exhaustion', kind: 'adjust_counter', title: 'Истощение +1', value_id: 'exhaustion', counter_key: 'level', delta: 1, max: 6}]}]}}
    const effect = {id: 100, typeId: 15, name: 'Ярость', data: {code: 'rage'}}
    const values = {lvl: {level: 5}, actions: [{uid: 'own', title: 'Своё действие', action_type: 'action', description: '<p>Описание</p>'}], abilities_class: scenario === 'manual' ? [] : [{id: 20, count: 1}], states: scenario === 'blocked-status' ? [] : [{uid: 'rage', effect_id: 100}]}
    const catalogue = [item, effect]; const map = new Map(catalogue.map(row => [String(row.id), row]))
    const expected = actionRules.collectCharacterFeatureActions(values, map, resources.collectCharacterResources(values, map)).map(row => ({key: row.key, title: row.title, type: row.action_type, description: row.description, source: row.source_label, resource: row.resource ? {value: row.resource.value, total: row.resource.total} : null}))
    cases.push({name: `actions-${scenario}`, kind: 'featureActions', values, catalogue, expected})
  }

  const spellMath = await server.ssrLoadModule('/src/features/character-editor/blocks/dnd/composables/useSpellCalc.js')
  const fixedDC = await server.ssrLoadModule('/src/shared/lib/spellSaveDC.js')
  for(const scenario of ['basic','upcast','critical','cantrip','heal','mixed','threshold','capped','type-choice','modifier','grant-ability']) {
    const item={id:5,typeId:5,name:'Проверка магии',data:{lvl:1,damage:{dices:[{count:1,dice_id:'d6',type:1,bonus:1}],addon:[{count:1,dice_id:'d6',type:1,bonus:1}],scaling:'slot',add_mod:true}}}
    const castLevel=['basic','grant-ability'].includes(scenario)?1:scenario==='threshold'||scenario==='capped'?5:3
    const characterLevel=scenario==='cantrip'?11:5
    if(scenario==='basic') item.data.damage.save_dc=17
    if(scenario==='cantrip') {item.data.lvl=0;item.data.damage.scaling='cantrip'}
    if(scenario==='heal') {item.data.heal=item.data.damage;delete item.data.damage}
    if(scenario==='mixed') item.data.damage.addon=[{count:2,dice_id:'d4',type:2,bonus:0}]
    if(scenario==='threshold') item.data.damage.scaling_levels=[{level:3},{level:5}]
    if(scenario==='capped') item.data.damage.scaling_max_steps=1
    if(scenario==='type-choice') {
      item.data.damage.type_choices=[1,2]
      for(const row of [...item.data.damage.dices,...item.data.damage.addon]) row.type=null
    }
    const feat={id:7,typeId:7,name:'Усиление',data:{spell_modifiers:[{spell_id:5,damage_ability:6}]}}
    const reference={key:'spell',id:5,...(scenario==='grant-ability'?{casting_ability:6}:{})}
    const values={lvl:{level:characterLevel},INT:{value:{base:16,bonuses:[]}},CHA:{value:{base:12,bonuses:[]}},prof_bonus:{auto:true,v:2,bonuses:[]},abilities_feats:scenario==='modifier'?[{id:7}]:[],spells:{tabs:[{key:'book',casting_ability:4,attack_bonus:1,save_bonus:2,spells:[reference]}],grants:[]}}
    const metadata={suggests:{'12':[{id:1,typeId:12,value:'Огонь',color:'#ef4444'},{id:2,typeId:12,value:'Холод',color:'#38bdf8'}]}}
    const catalogue=[item,feat];const map=new Map(catalogue.map(row=>[String(row.id),row]))
    const modifiers=await server.ssrLoadModule('/src/features/character-editor/lib/characterSpellModifiers.js')
    const calc=spellMath.useSpellCalc({diceMap:ref({d6:'d6',d4:'d4'}),diceDetailsMap:ref({d6:{value:'d6',sides:6},d4:{value:'d4',sides:4}}),damageTypeMap:ref({1:'Огонь',2:'Холод'}),damageTypeColorMap:ref({1:'#ef4444',2:'#38bdf8'}),schoolMap:ref({}),spellModifiers:ref(modifiers.collectCharacterSpellModifiers(values,map))})
    const kind=scenario==='heal'?'heal':'damage';const ability=scenario==='grant-ability'?6:4;const modifier=ability===6?1:3
    const resolved=JSON.parse(JSON.stringify(item))
    if(scenario==='type-choice') for(const row of [...resolved.data.damage.dices,...resolved.data.damage.addon]) if(!row.type) row.type=2
    const parts=kind==='heal'?calc.healDiceParts(resolved,castLevel,characterLevel,modifier):calc.damageDiceParts(resolved,castLevel,characterLevel,modifier)
    const terms=parts.flatMap(part=>[
      ...(part.diceSides?[{expression:`${part.count*(scenario==='critical'?2:1)}d${part.diceSides}`,label:kind==='heal'?'':part.type,color:kind==='heal'?'':part.typeColor}]:[]),
      ...(part.bonus?[{expression:String(part.bonus),label:kind==='heal'?'':part.type,color:kind==='heal'?'':part.typeColor}]:[]),
    ])
    const proficiency=2+Math.floor((characterLevel-1)/4)
    cases.push({name:`spell-${scenario}`,kind:'spellMath',values,catalogue,metadata,options:{kind,optionKey:kind,castLevel,critical:scenario==='critical',...(scenario==='type-choice'?{damageType:2}:{})},expected:{ability,modifier,attack:proficiency+modifier+1,save:fixedDC.resolveSpellSaveDC(item.data.damage,8+proficiency+modifier+2),terms}})
  }

  const expiryRules=await server.ssrLoadModule('/src/features/character-editor/lib/createdItemExpiry.js')
  for(const scenario of ['inert','vanish','permanent','equipped']) {
    const entry={uid:'created',item_id:207,count:3,params:{note:'keep',creation:{cast_id:'same',duration:{kind:scenario==='permanent'?'permanent':'hours',value:24},on_expire:scenario==='inert'?'inert':'vanish'}}}
    const sibling={...entry,uid:'sibling'}
    const values={weapon:[],items:{equipped:scenario==='equipped'?[entry]:[],sections:[{id:'bag',items:scenario==='equipped'?[sibling]:[entry,sibling],slots:{created:1,sibling:2},custom:'keep'}]}}
    const expected={...values,...expiryRules.expireCreatedItem(values,'created')}
    cases.push({name:`expiry-${scenario}`,kind:'createdExpiry',values,expected})
  }

  const usesRules=await server.ssrLoadModule('/src/features/character-editor/lib/confirmedItemUses.js')
  const lastChargeRules=await server.ssrLoadModule('/src/features/character-editor/lib/itemLastCharge.js')
  const cooldownRules=await server.ssrLoadModule('/src/features/character-editor/lib/itemUseCooldowns.js')
  const luckBlade=JSON.parse(await readFile(path.join(root,'tests/fixtures/mechanics/luck-blade.json'),'utf8'))
  for(const scenario of ['confirm','cooldown','carried','empty','missing-stock','last-charge','safe-charge','undo','dawn']) {
    const item={id:134,typeId:19,name:'Клинок',data:{...luckBlade,attunement:'none',weapon:{base_item_id:49},last_charge:{dice:'d20',failure_max:1,consequence:'lose_magic',resource_key:'wishes'}}}
    const entry={uid:'one',item_id:49,magic_item_id:134,params:{note:'keep',magic:{resource_maxima:{wishes:2},resource_counts:{luck:1,wishes:scenario==='empty'?0:1}}}}
    if(scenario==='missing-stock') delete entry.params.magic.resource_maxima
    if(scenario==='cooldown'||scenario==='dawn') entry.params.magic.use_cooldowns={wish:1,other:7}
    const sibling={...structuredClone(entry),uid:'two'}
    let values={lvl:{level:5},weapon:scenario==='carried'?[]:[entry,sibling],items:{equipped:[],sections:[{id:'bag',items:scenario==='carried'?[entry,sibling]:[]}]}}
    const catalogue=[item];const map=new Map([['134',item]])
    const before=structuredClone(values)
    const get=values=>(values.weapon.length?values.weapon:values.items.sections[0].items)[0]
    let useKey=scenario==='carried'?'luck':'wish'
    if(scenario==='dawn') values={...values,...cooldownRules.advanceItemUseCooldowns(values,map).patch}
    else {
      values={...values,...usesRules.confirmItemUse(values,map,'one',useKey,true)}
      if(['last-charge','safe-charge','undo'].includes(scenario)) {
        const id=get(values).params.magic.last_charge_check.id
        values={...values,...lastChargeRules.resolveLastCharge(values,'one',id,scenario==='safe-charge'?20:1)}
        if(scenario==='undo') values={...values,...lastChargeRules.undoLastCharge(values,'one',id)}
      }
    }
    const normalize=value=>{
      if(Array.isArray(value))return value.map(normalize)
      if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['created_at','resolved_at','undone_at'].includes(key)).map(([key,val])=>[key,key==='last_charge_check'?normalize({...val,id:'check'}):normalize(val)]))
      return value
    }
    cases.push({name:`item-use-${scenario}`,kind:'confirmedUse',scenario,useKey,values:before,catalogue,expected:normalize(values)})
  }

  const sequenceRules=await server.ssrLoadModule('/src/features/character-editor/blocks/dnd/lib/spellSequence.js')
  for(const scenario of ['table','projectiles','cantrip']) {
    const fixture=structuredClone(cases.find(row=>row.name==='spell-upcast'))
    const item=fixture.catalogue[0]
    item.data.range={distance:120}
    item.data.damage.range_attack=true
    item.data.damage.roll_table={sides:8,choices:[{value:1,type:1},{value:2,type:2}]}
    if(scenario==='projectiles') {item.data.damage.instances=1;item.data.damage.addon_instances=1;item.data.damage.attack_chain={trigger:'odd_attack'}}
    if(scenario==='cantrip') {item.data.lvl=0;item.data.damage.scaling='cantrip';item.data.damage.addon_instances=1;fixture.values.lvl.level=17}
    const castLevel=scenario==='cantrip'?0:fixture.options.castLevel
    const charLevel=fixture.values.lvl.level
    const parts=spellMath.useSpellCalc({diceMap:ref({d6:'d6'}),diceDetailsMap:ref({d6:{value:'d6',sides:6}}),damageTypeMap:ref({1:'Огонь'}),damageTypeColorMap:ref({1:'#ef4444'}),schoolMap:ref({})}).damageDiceParts(item,castLevel,charLevel,3)
    const expression=critical=>parts.flatMap(part=>[part.diceSides?`${part.count*(critical?2:1)}d${part.diceSides}{${part.type}|${part.typeColor}}`:'',part.bonus?`${part.bonus}{${part.type}|${part.typeColor}}`:''].filter(Boolean)).join('+')
    const proficiency=2+Math.floor((charLevel-1)/4)
    const parameters={castLevel,charLevel,attackBonus:proficiency+3+1,attackBonusFormula:'',damageExpression:expression(false),criticalExpression:expression(true)}
    const attack={parts:[{kind:'dice',operator:'+',sign:'+',n:1,sides:20,rolls:[12],sum:12,label:null,color:null},{kind:'flat',operator:'+',sign:'+',value:parameters.attackBonus,sum:parameters.attackBonus,label:null,color:null}],byType:[{label:null,color:null,value:12+parameters.attackBonus}],total:12+parameters.attackBonus,expression:`1d20+${parameters.attackBonus}`,rollMode:'normal'}
    cases.push({name:`sequence-${scenario}`,kind:'spellSequence',values:fixture.values,catalogue:fixture.catalogue,metadata:fixture.metadata,options:{kind:'attack',castLevel},expected:sequenceRules.spellSequence(item,attack,parameters).sequence})
  }

  for(const scenario of ['plain-fighter','repeatable-origin','feat-spell']) {
    const version=scenario==='repeatable-origin'?'2024':'2014'
    const race={id:81,typeId:8,name:'Человек',data:{speed:30,...(scenario==='plain-fighter'?{}:{feat_choice:{count:1}})}}
    const charClass={id:91,typeId:9,name:'Воин',nameEn:'Fighter',data:{hit_die:'d10'}}
    const background={id:111,typeId:11,name:'Истоки',data:{...(version==='2024'?{ability_options:[1,2,3],origin_feat_id:77}:{})}}
    const feat={id:77,typeId:7,name:'Обучение',data:scenario==='repeatable-origin'?{category:'origin',repeatable:true,max_use:2,choices:[{key:'focus',count:1,from_suggest_id:16,ability_bonus:1,grant_proficiency:'save_prof'}]}:{choices:[{key:'spell',count:1,from_item_type_id:5,grant_spells:true,casting_ability:4}]}}
    const spell={id:22,typeId:5,name:'Огонёк',data:{lvl:0,classes:[91]}}
    const scores={STR:15,DEX:14,CON:13,INT:12,WIS:10,CHA:8}
    const choices=scenario==='repeatable-origin'?{'77|focus':['1'],'origin:77|focus':['2'],feats:['77']}:scenario==='feat-spell'?{'77|spell':['22'],feats:['77']}:{}
    const input={name:'Герой',rulesVersion:version,race:{id:81,name:race.name,item:race},charClass:{id:91,name:charClass.name,item:charClass},background:{id:111,name:background.name,item:background},scores,backgroundAsi:version==='2024'?{DEX:2,CON:1}:{},feats:scenario==='plain-fighter'?[]:[{item:feat,choices:scenario==='repeatable-origin'?{focus:[1]}:{spell:[22]}}],...(version==='2024'?{originFeat:feat,originFeatChoices:{focus:[2]}}:{}),suggestValue:(type,id)=>`label-${type}-${id}`}
    const result=assembler.buildCharacterData(input).data.values
    const selected=['STR','DEX','CON','hp','proficiencies','abilities_feats','spells']
    const aliases=new Map((result.abilities_feats||[]).filter(row=>row.uid).map((row,index)=>[row.uid,`entry-${index}`]))
    function normalize(value) {
      if(Array.isArray(value))return value.map(normalize)
      if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,val])=>[key,normalize(val)]))
      if(typeof value==='string')return aliases.get(value)||(value.startsWith('feat:')&&aliases.has(value.slice(5))?`feat:${aliases.get(value.slice(5))}`:value)
      return value
    }
    cases.push({name:`creation-features-${scenario}`,kind:'creationFeatures',catalogue:[race,charClass,background,feat,spell],draft:{name:'Герой',version,method:'point',scores,backgroundAsi:input.backgroundAsi,selected:{race:81,charClass:91,background:111},choices},keys:selected,expected:normalize(Object.fromEntries(selected.filter(key=>key in result).map(key=>[key,result[key]])))})
  }

  const choiceRules = await server.ssrLoadModule('/src/features/items/lib/characterChoiceEligibility.js')
  const choiceFilters = await server.ssrLoadModule('/src/features/items/lib/itemChoices.js')
  const expertise = { id: 10, typeId: 4, name: 'Источник', data: { class_ids: [1], derived_effects: [
    { kind: 'skill_proficiency', rank: 2, choice_key: 'choice', choice_value_prefix: 'skill', target_from_choice: true },
  ] } }
  for (const doubled of [false,true]) for (const value of ['skill:2','tool:18','skill:9']) {
    const values = {lvl:{level:6},classes:[{id:1,level:6}],DEX:{skills:{2:{up:1}}},proficiencies:{Инструменты:['Воровские инструменты']},abilities_class:doubled?[{id:10,choices:{choice:['skill:2']}}]:[]}
    const suggests={'5':[{id:18,typeId:5,value:'Воровские инструменты'}]}
    const choice={requires_proficiency:true,exclude_rank:2}
    const ctx={values,items:[expertise],suggestItems:type=>suggests[String(type)]||[]}
    cases.push({name:`choice-rank-${doubled}-${value}`,kind:'characterChoice',values,catalogue:[expertise],suggests,choice,value,rank:choiceRules.characterChoiceTargetRank(value,ctx),expected:choiceRules.characterChoiceOptionEligibility(choice,value,ctx)})
  }
  for (const selection of [[],[11],[12]]) {
    const choice={source:'item',from_item_type_id:5,item_filter:'lvl=0',item_filter_from_choice:{choice_key:'class',path:'classes'}}
    const selections={class:selection};const candidate={id:50,typeId:5,name:'Заговор',data:{lvl:0,classes:[11]}}
    const filter=choiceFilters.resolvedItemChoiceFilter(choice,selections)
    cases.push({name:`choice-filter-${selection.join('-')||'empty'}`,kind:'choiceFilter',choice,selections,candidate,expected:filter,matches:choiceFilters.itemMatchesChoiceFilter(candidate,filter)})
  }

  const bags = await server.ssrLoadModule('/src/features/inventory/lib/bagSlots.js')
  const spaces = await server.ssrLoadModule('/src/features/character-editor/blocks/dnd/lib/inventorySpaces.js')
  const itemSection = await server.ssrLoadModule('/src/features/character-editor/blocks/dnd/lib/itemSection.js')
  const economy = await server.ssrLoadModule('/src/features/items/lib/itemPackaging.js')
  for(const width of [0,71,72,151,152,320,834]) cases.push({name:`inventory-columns-${width}`,kind:'inventoryColumns',width,expected:bags.bagColumnCount(width)})
  const entries=['a','b','c','d'].map(uid=>({uid})),positions={a:5,b:5,c:-2,d:'2'}
  cases.push({name:'inventory-slot-reservations',kind:'inventorySlots',entries,positions,columns:4,expected:bags.resolveBagSlots(entries,positions),cells:bags.bagCells(entries,positions).map(entry=>entry?.uid??null)})
  const inventory=itemSection.normalizeValue({equipped:[{uid:'worn',item_id:12,count:1}],sections:[{id:'bag',name:'Рюкзак',items:[{uid:'a',item_id:1,count:3},{uid:'b',item_id:2,count:2}],slots:{a:0,b:1,worn:2}},{id:'chest',name:'Сундук',items:[{uid:'c',item_id:3,count:1}],slots:{c:2}}]})
  for(const move of [{uid:'a',fromId:'bag',toId:'chest',toSlot:0},{uid:'a',fromId:'bag',toId:'chest',toSlot:2},{uid:'worn',fromId:'bag',toId:'chest',toSlot:2},{uid:'c',fromId:'chest',toId:'bag',toSlot:2},{uid:'a',fromId:'bag',toId:'bag',toSlot:1},{uid:'a',fromId:'bag',toId:'bag',toSlot:0}]) {
    const next=structuredClone(inventory);spaces.moveInventoryCell(next,move)
    cases.push({name:`inventory-move-${move.uid}-${move.fromId}-${move.toId}-${move.toSlot}`,kind:'inventoryMove',model:inventory,move,expected:next})
  }
  for(const sequence of [['a'],['a','a'],['c','worn']]) {
    const next=structuredClone(inventory);for(const uid of sequence) spaces.toggleInventoryEquipment(next,uid)
    cases.push({name:`inventory-equip-${sequence.join('-')}`,kind:'inventoryToggle',model:inventory,sequence,expected:next})
  }
  const unplaced=structuredClone(inventory);delete unplaced.sections[0].slots.worn
  const normalized=spaces.normalizeInventorySpaces(structuredClone(unplaced))
  cases.push({name:'inventory-normalize-worn-space',kind:'inventoryNormalize',model:unplaced,expected:normalized,spaces:normalized.sections.map(section=>({id:section.id,entries:spaces.inventorySpaceEntries(normalized,section.id).map(entry=>entry.uid)}))})
  for(const [data,entry] of [[{purchase_quantity:20,cost:{value:100,suggest_id:1},weight:1.5},{count:10}],[{purchase_quantity:20,cost:{value:100,suggest_id:1},weight:1.5},{count:5,override:{cost:{value:3,suggest_id:1},weight:.2}}],[{unit_cost_copper:2,unit_weight:.1},{count:2,params:{length_ft:7.5}}],[{cost:{min:1,max:3,suggest_id:2},weight:2},{count:3}],[{},{count:4,override:{cost:{value:2,suggest_id:1},weight:.5}}],[{purchase_quantity:0,weight:1},{count:2}],[{},{}]]) {
    const item={id:50,typeId:2,name:'Предмет',data}
    cases.push({name:`inventory-economy-${cases.filter(row=>row.kind==='inventoryEconomy').length}`,kind:'inventoryEconomy',item,entry,expected:economy.inventoryItemEconomy(item,entry)})
  }

  const tools = await server.ssrLoadModule('/src/features/character-editor/blocks/dnd/lib/toolChecks.js')
  const profs = await server.ssrLoadModule('/src/features/character-editor/lib/itemProficiency.js')
  const derivedTools = await server.ssrLoadModule('/src/features/character-editor/lib/characterDerivedEffects.js')
  const basicDnd = await server.ssrLoadModule('/src/shared/lib/dnd.js')
  for(const variant of ['none','manual','expert']) for(const ability of [{key:'STR',id:1},{key:'INT',id:4}]) {
    const item={id:50,typeId:14,name:'Воровские инструменты',data:{required_tool_proficiencies:[18]}}
    const feat={id:7,typeId:7,name:'Мастер',data:{derived_effects:[{kind:'tool_proficiency',rank:2,target_ids:[18]},{kind:'check_bonus',value:2,scopes:['tool']},{kind:'check_bonus',value:9,scopes:['saving_throw']},{kind:'roll_mode',mode:'advantage',scopes:['tool']}]}}
    const values={lvl:{level:5},STR:{value:{base:12,bonuses:[]}},INT:{value:{base:16,bonuses:[]}},proficiencies:{Инструменты:variant==='manual'?['Воровские инструменты']:[]},abilities_feats:variant==='expert'?[{id:7}]:[],items:{equipped:[],sections:[{id:'bag',name:'Сумка',items:[{uid:'tool',item_id:50,count:1}]}]}}
    const suggests={'5':[{id:18,typeId:5,value:'Воровские инструменты'}]}
    const effects=derivedTools.collectCharacterDerivedEffects(values,new Map([['50',item],['7',feat]]))
    const manual=profs.hasItemProficiency(item,values,type=>suggests[String(type)]||[],derivedTools.derivedGrantedProficiencies(effects,'tool_proficiency'))
    const rank=tools.toolProficiencyRankFor(item,manual,id=>derivedTools.derivedProficiency(effects,'tool_proficiency',{targetId:id}).rank)
    const ctx={kind:'tool',abilitySuggestId:ability.id,proficient:rank>0,item}
    const bonus=tools.toolCheckBonusFor(values,ability.key,rank,basicDnd.proficiencyBonus(5),derivedTools.derivedNumericBonus(effects,'check_bonus',values,ctx).total)
    cases.push({name:`tool-check-${variant}-${ability.key}`,kind:'toolCheck',values,catalogue:[item,feat],suggests,ability:ability.id,expected:{rank,bonus,modes:derivedTools.derivedRollEffects(effects,ctx).map(row=>row.mode)}})
  }

  const serialized = `${JSON.stringify({ protocol: 1, cases }, null, 2)}\n`
  if (process.argv.includes('--check')) {
    if (await readFile(output, 'utf8') !== serialized) throw new Error('Regenerate native/fixtures/character-rules.json')
  } else await writeFile(output, serialized)
  console.log(`${cases.length} shared character rule fixtures ${process.argv.includes('--check') ? 'match' : 'generated'}`)
} finally { await server.close() }
