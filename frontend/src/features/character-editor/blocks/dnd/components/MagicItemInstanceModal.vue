<template>
  <MagicEquipmentInstanceModal v-if="missingBases.length" :item="baseChoiceItem" :params="entry?.params" confirm-label="Сохранить основу" @close="$emit('close')" @confirm="setBase" />
  <AppModalFrame v-else :title="item.name" subtitle="Параметры экземпляра" :z-index="4500" @close="$emit('close')">
    <div class="ability-rule-fields">
      <FormField v-if="item.data?.manual_size" label="Максимум зарядов" vertical>
        <FormTextInput type="number" :value="state.max_use ?? item.data.max_use" :min="0" @update:value="value => save({ max_use: value })" />
      </FormField>
      <ActionButton v-if="hasChoices" variant="secondary" @click="choosing = true">Выбрать свойства предмета</ActionButton>
    </div>
    <FeatChoiceModal v-if="choosing" :item="item" :initial-choices="state.choices || {}" @close="choosing = false" @confirm="choices => { save({ choices }); choosing = false }" />
  </AppModalFrame>
</template>
<script setup>
import { computed, ref } from 'vue'
import { ActionButton, AppModalFrame, FormField, FormTextInput } from '@sylvieshare/share-ui'
import MagicEquipmentInstanceModal from '@/features/items/components/MagicEquipmentInstanceModal.vue'
import FeatChoiceModal from '@/features/character-editor/components/FeatChoiceModal.vue'
import { actionableItemChoices } from '@/features/items/lib/itemChoices'
import { inventoryEntries, mapOwnedEntries } from '@/features/character-editor/lib/characterMagicItems'
import { fillMissingMagicBases, missingMagicBases } from '@/features/character-editor/lib/magicItemSettings'
const props = defineProps({ item: Object, uid: String, values: Object })
const emit = defineEmits(['close', 'update:values'])
const entry = computed(() => inventoryEntries(props.values).find(row => row.entry.uid === props.uid)?.entry)
const state = computed(() => entry.value?.params?.magic || {})
const missingBases = computed(() => missingMagicBases(props.item, entry.value))
const baseChoiceItem = computed(() => ({ ...props.item, data: { ...props.item.data, weapon: missingBases.value.includes('weapon') ? props.item.data.weapon : undefined, armor_base: missingBases.value.includes('armor_base') ? props.item.data.armor_base : undefined } }))
const hasChoices = computed(() => actionableItemChoices(props.item).length > 0)
const choosing = ref(false)
function setBase(params) { emit('update:values', fillMissingMagicBases(props.values, props.item, props.uid, params)); emit('close') }
function save(patch) { emit('update:values', mapOwnedEntries(props.values, row => row.uid === props.uid ? { ...row, params: { ...row.params, magic: { ...row.params?.magic, ...patch } } } : row)) }
</script>
