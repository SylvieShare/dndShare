import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { computed, createApp, h, provide, reactive } from 'vue'
import { createPinia } from 'pinia'
import DndWeapons from '../../src/features/character-editor/blocks/dnd/DndWeapons.vue'
import { useCharacterCombatEffects } from '../../src/features/character-editor/composables/useCharacterCombatEffects'
import { useCharacterDerivedEffects } from '../../src/features/character-editor/composables/useCharacterDerivedEffects'
import { useCharacterRollEffects } from '../../src/features/character-editor/composables/useCharacterRollEffects'
import { itemFieldEditorKey } from '../../src/features/character-editor/components/useItemFieldEditor'
import { useDiceStore } from '../../src/stores/dice'
import { useSuggestStore } from '../../src/stores/suggest'

const block = { id: 'weapon', content: {
  tag_suggest_type_id: 14, type_attack_suggest_type_id: 12, stat_suggest_type_id: 16, bonus_path: 'proficiency',
} }

export function weaponItem(id, name, die, data = {}) {
  return { id, name, typeId: 1, data: { attacks: [{ count: 1, dice_id: die, type: 1 }], ...data } }
}

export function mountWeaponFixture({ storageKey, weapons, items, editorData, renderEditor, createView, initialValues, configureDice }) {
  const params = new URLSearchParams(location.search)
  const pinia = createPinia()
  const suggest = useSuggestStore(pinia)
  suggest.set(4, [])
  suggest.set(12, [{ id: 1, value: 'Колющий' }, { id: 9, value: 'Молния', color: '#ff0' }])
  suggest.set(14, [{ id: 6, value: 'Метательное' }])
  suggest.set(16, [{ id: 1, value: 'Сила' }, { id: 2, value: 'Ловкость' }])

  const itemsById = new Map(items.map(item => [String(item.id), item]))
  const ctx = reactive({
    ownerMode: true,
    values: JSON.parse(sessionStorage.getItem(storageKey) || 'null') || {
      lvl: { level: 5 }, STR: { value: { base: 16 } }, DEX: { value: { base: 16 } },
      proficiency: 2, weapon: weapons, ...initialValues,
    },
    characterResources: {
      itemsById,
      ensureItems: async (ids = []) => ({ items: ids.map(id => itemsById.get(String(id))).filter(Boolean) }),
    },
    updateValues(patch) {
      this.values = { ...this.values, ...patch }
      sessionStorage.setItem(storageKey, JSON.stringify(this.values))
    },
    logSessionEvent(event) { window.logged.push(event) },
  })

  Object.assign(window, { ctx, editorData, editorError: '', logged: [], attackResults: [], attackEffects: [], natural: 10 })
  const dice = useDiceStore(pinia)
  const rollD20 = dice.rollD20
  dice.rollD20 = (title, bonus, mode, options) => {
    const random = Math.random
    const naturalRolls = [...(window.testRolls || [])]
    try {
      Math.random = () => ((naturalRolls.shift() ?? window.natural) - 0.5) / 20
      const result = rollD20(title, bonus, mode, { ...options, log: false, popup: false })
      window.attackResults.push(result)
      return result
    } finally {
      Math.random = random
    }
  }
  configureDice?.(dice)
  createApp({
    setup() {
      const values = computed(() => ctx.values)
      const itemMap = computed(() => ctx.characterResources.itemsById)
      ctx.characterDerivedEffects = useCharacterDerivedEffects(values, itemMap)
      ctx.characterCombatEffects = useCharacterCombatEffects(values, itemMap, ctx)
      ctx.characterRolls = useCharacterRollEffects({}, [
        context => ctx.characterDerivedEffects.rollEffects(context),
        () => window.attackEffects,
      ])
      provide('charCtx', ctx)
      provide(itemFieldEditorKey, {
        itemData: editorData,
        getSuggestId: field => field.suggest_id,
        getSuggests: id => suggest.items(id),
        setValidationError(key, value) { window.editorError = value },
      })
      const extra = createView?.(ctx)
      return () => h('main', { style: 'max-width:900px;margin:8px' }, params.has('editor')
        ? [renderEditor()]
        : [
            h(DndWeapons, { block, values: ctx.values, value: ctx.values.weapon, 'onUpdate:value': (id, value) => ctx.updateValues({ [id]: value }) }),
            extra?.(),
          ])
    },
  }).use(pinia).mount('#app')
}
