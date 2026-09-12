<template>
  <AppModalFrame :title="parent.name" :z-index="3300" @close="$emit('close')">
    <LoadingState v-if="loading" label="Загрузка способностей…" />
    <p v-else-if="error" role="alert">{{ error }} <ActionButton @click="load">Повторить</ActionButton></p>
    <AbilitySelectionPanel v-else :parent="parent" :values="values" :original-values="values" :items="items" @change="plan = $event" />
    <template #footer><ActionButton :disabled="!plan?.ready || saving || loading" @click="apply">Сохранить выбор</ActionButton></template>
  </AppModalFrame>
</template>
<script setup>
import { inject, onMounted, ref } from 'vue'
import { ActionButton, AppModalFrame, LoadingState } from '@sylvieshare/share-ui'
import AbilitySelectionPanel from './AbilitySelectionPanel.vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { abilitySelectionState, applyAbilitySelection, selectedAbilityEntries } from '../lib/selectedAbilities'
import { abilitySpellGrantRows, syncAbilityGrantedSpells } from '../blocks/dnd/lib/abilitySpellGrants'
import { featureItemIds } from '../lib/characterMagicItems'
import { emptySpellbook } from '../blocks/dnd/lib/spellbook'
const props = defineProps({ parent: { type: Object, required: true }, values: { type: Object, required: true } })
const emit = defineEmits(['close', 'apply'])
const context = inject('charCtx', {})
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const items = ref([])
const plan = ref(null)
async function load() {
  loading.value = true
  error.value = ''
  try {
    const [result, owned] = await Promise.all([
      itemsApi.listAll(4, { contentSources: context.contentSources, sourceVersionId: context.sourceVersionId }),
      itemsApi.byIds((props.values.abilities_class || []).map(entry => entry.id)),
    ])
    items.value = [...new Map([...result.items, ...owned.items].map(item => [String(item.id), item])).values()]
  } catch { error.value = 'Не удалось загрузить способности.' }
  finally { loading.value = false }
}
async function apply() {
  if (!plan.value?.ready || saving.value) return
  saving.value = true
  try {
    const catalogue = plan.value.items
    const original = selectedAbilityEntries(props.values, props.parent, catalogue)
    const state = abilitySelectionState(props.parent, props.values, catalogue, plan.value.entries, original)
    if (!state.ready) return
    const next = applyAbilitySelection(props.values, props.parent, plan.value.entries, catalogue)
    const ids = featureItemIds(next)
    const result = await itemsApi.byIds(ids)
    if (ids.some(id => !result.items.some(item => String(item.id) === String(id)))) throw new Error('Missing items')
    const spells = emptySpellbook(next.spells)
    spells.grants = syncAbilityGrantedSpells(spells.grants, abilitySpellGrantRows(result.items, next))
    context.characterResources?.rememberItems?.(result.items)
    emit('apply', { abilities_class: next.abilities_class, spells })
  } catch { error.value = 'Не удалось сохранить выбор. Попробуйте ещё раз.' }
  finally { saving.value = false }
}
onMounted(load)
</script>
