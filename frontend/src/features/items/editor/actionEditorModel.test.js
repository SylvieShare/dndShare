import { describe, expect, it, vi } from 'vitest'
import { computed, effectScope, reactive } from 'vue'
import { actionEditorError, actionResourceMode, changeActionResource, localRuleReferences, normalizeActionResource, uniqueRuleKey } from './actionEditorModel'
import { useRuleKey } from './useRuleKey'
import { useAbilityDependencies } from './useAbilityDependencies'
import { abilityEditorProfile } from './abilityEditorProfile'
import schema from '../../../../../resources/items/item_4_shema.json'

describe('dependency cards', () => {
  it('keeps one array entry per card and removes only the chosen entry across repeated edits', () => {
    const data = reactive({ feature_actions: [{title:'Первое'}, {title:'Второе'}], granted_spells: [{spell:1}], desc:'Описание' })
    const profile = computed(() => abilityEditorProfile(schema, 4))
    const editor = useAbilityDependencies(profile, data)
    expect(editor.entries.value).toHaveLength(3)
    const block = profile.value.blocks.find(block => block.key === 'feature_actions')
    expect(editor.available.value).toContain(block)
    editor.add(block)
    expect(data.feature_actions).toHaveLength(3)
    const first = editor.entries.value.find(card => card.key === 'feature_actions')
    editor.remove(first)
    const second = editor.entries.value.find(card => card.key === 'feature_actions')
    editor.update(second, {title:'Изменённое'})
    expect(data.feature_actions[0].title).toBe('Изменённое')
    expect(data.feature_actions).toHaveLength(2)
    expect(data.granted_spells).toEqual([{spell:1}])
    expect(data.desc).toBe('Описание')
  })
  it('offers each independent resource as a repeatable dependency', () => {
    const profile = abilityEditorProfile(schema,4)
    expect(profile.blocks.find(block => block.key === 'use_resources').repeatable).toBe(true)
    expect(profile.blocks.find(block => block.key === 'resources').fields.map(field => field.key)).not.toContain('use_resources')
  })
})

describe('action key generation', () => {
  it('normalizes Russian titles and avoids collisions', () => {
    expect(uniqueRuleKey('Яростный удар!', ['yarostnyy_udar','yarostnyy_udar_2'])).toBe('yarostnyy_udar_3')
    expect(uniqueRuleKey('  !!!  ')).toBe('')
  })
  it('tracks title until any manual edit, including an explicit clear', () => {
    const scope = effectScope(), props = reactive({title:'Ярость',usedKeys:[]}), emit = vi.fn()
    const key = scope.run(() => useRuleKey(props, emit))
    expect(emit).toHaveBeenLastCalledWith('update:modelValue','yarost')
    props.title='Боевая ярость'
    expect(emit).toHaveBeenLastCalledWith('update:modelValue','boevaya_yarost')
    key.setManually('')
    props.title='Другое имя'
    expect(emit).toHaveBeenLastCalledWith('update:modelValue','')
    scope.stop()
  })
  it('preserves existing manual keys and deliberately empty saved keys on reopen', () => {
    for (const modelValue of ['custom','']) {
      const scope=effectScope(), props=reactive({modelValue,title:'Название',usedKeys:[]}),emit=vi.fn()
      scope.run(() => useRuleKey(props,emit))
      props.title='Переименовано'
      expect(emit).not.toHaveBeenCalled()
      scope.stop()
    }
  })
})

describe('action resources and typed links', () => {
  it('uses mutually exclusive sources and clears hidden fields when spending is off', () => {
    const data={resource_pool_key:'pool',resource_key:'dice',resource_item_id:5,resource_cost:3}
    expect(actionResourceMode(data)).toBe('pool')
    changeActionResource(data,'selected',{key:'new_dice',itemId:9})
    expect(data).toEqual({uses_resource:true,resource_cost:1,resource_key:'new_dice',resource_item_id:9})
    changeActionResource(data,'none')
    expect(data).toEqual({uses_resource:false})
  })
  it('normalizes overlapping saved fields without changing their effective source or cost', () => {
    const data={resource_pool_key:'pool',resource_key:'unused',resource_item_id:7}
    expect(normalizeActionResource(data)).toBe('pool')
    expect(data).toEqual({resource_pool_key:'pool',uses_resource:true,resource_cost:0})
  })
  it('finds unsaved links in the current form with their source and type', () => {
    const refs=localRuleReferences({max_use:3,use_resources:[{key:'dice',title:'Кости'}],feature_actions:[{key:'strike',title:'Удар'}]},4,'Мастерство')
    expect(refs).toContainEqual({kind:'resource',block:'Отдельный ресурс',key:'dice',title:'Кости',itemId:4,itemName:'Мастерство'})
    expect(refs.find(ref=>ref.key==='strike').kind).toBe('action')
  })
  it('rejects an unfinished source selection without rejecting a deliberately empty action key', () => {
    expect(actionEditorError({title:'Удар',key:''},'none',{})).toBe('')
    expect(actionEditorError({title:'Удар',uses_resource:true},'pool',{})).toContain('выберите общий ресурс')
    expect(actionEditorError({title:'Удар',uses_resource:true,resource_cost:1},'self',{})).toContain('добавьте основной ресурс')
  })
})
