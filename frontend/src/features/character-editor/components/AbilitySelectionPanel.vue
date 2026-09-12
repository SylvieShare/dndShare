<template>
  <section class="ability-selection" :data-tutorial="`ability-selection-${parent.id}`">
    <div class="ability-selection-heading">
      <h3>{{ parent.name }}</h3><span>{{ selected.length }} / {{ state.count }}</span>
    </div>
    <p class="ability-selection-hint">{{ hint }}</p>
    <p v-if="replacements && original.length" class="ability-selection-hint">Можно заменить {{ replacements }} из ранее изученных. Заменено: {{ state.removed }}.</p>
    <div v-for="entry in selected" :key="entry.id" class="ability-selection-row">
      <LevelUpItemRow :item="itemFor(entry.id)" :type-id="4" @details="viewItem = itemFor(entry.id)">
        <ActionButton v-if="isOriginal(entry) && replacements" variant="quiet" :disabled="state.removed >= replacements" @click="picker = { replacing: entry.id }">Заменить</ActionButton>
        <ActionButton v-if="!isOriginal(entry)" variant="quiet" @click="remove(entry.id)">Убрать</ActionButton>
      </LevelUpItemRow>
      <p v-for="reason in eligibility(itemFor(entry.id)).reasons" :key="reason" class="ability-selection-error">{{ reason }}</p>
    </div>
    <div class="ability-selection-buttons">
      <ActionButton v-if="selected.length < state.count" @click="picker = {}">Выбрать из справочника…</ActionButton>
      <ActionButton v-if="changed" variant="quiet" @click="reset">Сбросить изменения</ActionButton>
    </div>
    <p v-if="!state.ready" class="ability-selection-hint">{{ state.errors.join('. ') }}</p>
    <ItemPickerModal v-if="picker" :item-type-ids="[4]" :fixed-filters="{ selection_parent_id: parent.id }"
      :exclude-items="selected.map(entry => entry.id)" :item-eligibility="eligibility" :title="parent.name"
      search-placeholder="Поиск способности…" :z-index="3400" @pick="pick" @close="picker = null" />
    <FeatChoiceModal v-if="pending" :item="pending" @confirm="confirmChoices" @close="pending = null" />
    <ItemViewModal v-if="viewItem" :item-type-id="4" :item-id="viewItem.id" :item="viewItem" @close="viewItem = null" />
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import LevelUpItemRow from '@/features/character-editor/blocks/dnd/components/LevelUpItemRow.vue'
import FeatChoiceModal from './FeatChoiceModal.vue'
import { actionableItemChoices } from '@/features/items/lib/itemChoices'
import { abilitySelectionState, selectedAbilityEligibility, selectedAbilityEntries } from '../lib/selectedAbilities'

const props = defineProps({
  parent: { type: Object, required: true }, values: { type: Object, required: true },
  originalValues: { type: Object, required: true }, items: { type: Array, required: true },
  replacements: { type: Number, default: 0 },
})
const emit = defineEmits(['change'])
const original = computed(() => selectedAbilityEntries(props.originalValues, props.parent, props.items))
const selected = ref(original.value.map(entry => ({ ...entry })))
const pickedItems = ref([])
const picker = ref(null)
const pending = ref(null)
const pendingReplacement = ref(null)
const viewItem = ref(null)
const catalogue = computed(() => [...new Map([...props.items, ...pickedItems.value].map(item => [String(item.id), item])).values()])
const itemFor = id => catalogue.value.find(item => String(item.id) === String(id)) || { id, name: `#${id}` }
const state = computed(() => abilitySelectionState(props.parent, props.values, catalogue.value, selected.value, original.value, props.replacements))
const changed = computed(() => JSON.stringify(selected.value) !== JSON.stringify(original.value))
const hint = computed(() => props.replacements ? 'Выберите новые способности и при желании замените одну ранее изученную.' : 'Заполните недостающие способности. Замена ранее изученных доступна при повышении уровня класса.')
const eligibility = item => selectedAbilityEligibility(item, props.parent, props.values)
const isOriginal = entry => original.value.some(old => String(old.id) === String(entry.id))
function reset() { selected.value = original.value.map(entry => ({ ...entry })); picker.value = null }
function remove(id) { selected.value = selected.value.filter(entry => entry.id !== id) }
function finish(item, choices = {}) {
  if (!eligibility(item).eligible) return
  const entry = { id: item.id, choices }
  if (pendingReplacement.value != null) selected.value = selected.value.map(old => old.id === pendingReplacement.value ? entry : old)
  else if (selected.value.length < state.value.count) selected.value = [...selected.value, entry]
  picker.value = null
  pending.value = null
}
function pick(item) {
  if (!eligibility(item).eligible || selected.value.some(entry => entry.id === item.id)) return
  pickedItems.value.push(item)
  pendingReplacement.value = picker.value?.replacing ?? null
  if (actionableItemChoices(item).length) { pending.value = item; return }
  finish(item)
}
function confirmChoices(choices) { finish(pending.value, choices) }
const plan = computed(() => ({ parentId: props.parent.id, entries: selected.value, ready: state.value.ready }))
watch(() => JSON.stringify(plan.value), value => emit('change', { ...JSON.parse(value), items: catalogue.value }), { immediate: true })
</script>

<style scoped>
.ability-selection { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.ability-selection-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ability-selection-heading h3 { margin: 0; color: var(--text-1); font-size: 15px; }
.ability-selection-heading span { color: var(--accent); font-weight: 700; }
.ability-selection-hint { margin: 0; color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.ability-selection-error { margin: 4px 0; color: var(--danger); font-size: 12px; }
.ability-selection-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
