<template>
  <AppModalFrame :title="item.name" subtitle="Магические свойства экземпляра" :z-index="4500" @close="$emit('close')">
    <div class="ability-rule-fields">
      <p>{{ active ? 'Свойства предмета действуют на листе.' : !levelAvailable ? 'Свойства пока недоступны на этом уровне.' : equipped || item.data?.activation === 'carried' ? 'Для магических свойств нужна настройка.' : 'Переместите предмет в «Экипировано», чтобы его свойства действовали.' }}</p>
      <MagicEquipmentBases v-for="base in selectedBases" :key="base.kind" :item="base.item" :kind="base.kind" />
      <ActionButton v-if="magicEquipmentKinds(item).length" variant="secondary" @click="changingBase = true">Изменить основу</ActionButton>
      <MagicEquipmentInstanceModal v-if="changingBase" :item="item" :params="entry?.params" confirm-label="Сохранить основу" @close="changingBase = false" @confirm="setBase" />
      <FormField v-if="item.data?.attunement !== 'none'" label="Настроен на персонажа" :title="item.data?.attunement_requirement || 'Отметьте после настройки на этот экземпляр.'">
        <ToggleSwitch :model-value="!!state.attuned" aria-label="Настроен на персонажа" @update:model-value="value => save({ attuned: value })" />
      </FormField>
      <p v-if="item.data?.attunement_requirement">{{ item.data.attunement_requirement }}</p>
      <p v-if="item.data?.attunement === 'unknown'">Требование настройки не уточнено. Проверьте описание с мастером.</p>
      <p v-if="item.data?.recharge_note">Восстановление зарядов: {{ item.data.recharge_note }}</p>
      <FormField v-if="item.data?.manual_size" label="Максимум зарядов" vertical>
        <FormTextInput type="number" :value="state.max_use ?? item.data.max_use" :min="0" @update:value="value => save({ max_use: value })" />
      </FormField>
      <button v-if="hasChoices" type="button" class="btn-secondary" @click="choosing = true">Выбрать свойства предмета</button>
    </div>
    <FeatChoiceModal v-if="choosing" :item="item" :initial-choices="state.choices || {}" @close="choosing = false" @confirm="choices => { save({ choices }); choosing = false }" />
  </AppModalFrame>
</template>
<script setup>
import { computed, inject, ref, unref } from 'vue'
import { ActionButton, AppModalFrame, FormField, FormTextInput, ToggleSwitch } from '@sylvieshare/share-ui'
import MagicEquipmentInstanceModal from '@/features/items/components/MagicEquipmentInstanceModal.vue'
import MagicEquipmentBases from '@/features/items/components/MagicEquipmentBases.vue'
import { magicEquipmentKinds, magicBaseId } from '@/features/items/lib/magicEquipmentBases'
import FeatChoiceModal from '@/features/character-editor/components/FeatChoiceModal.vue'
import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'
import { actionableItemChoices } from '@/features/items/lib/itemChoices'
import { magicItemActive, updateMagicItemState, mapInventoryEntries } from '@/features/character-editor/lib/characterMagicItems'
const props = defineProps({ item: Object, uid: String, items: Object })
const emit = defineEmits(['close', 'update:items'])
const equipped = computed(() => (props.items?.equipped || []).some(entry => entry.uid === props.uid))
const entry = computed(() => [...(props.items?.equipped || []), ...(props.items?.sections || []).flatMap(s => s.items || [])].find(entry => entry.uid === props.uid))
const selectedBases = computed(() => magicEquipmentKinds(props.item).flatMap(kind => {
  const id = magicBaseId(props.item, entry.value?.params, kind)
  return id ? [{ kind, item: { ...props.item, data: { ...props.item.data, [kind]: { ...props.item.data[kind], base_item_id: id } } } }] : []
}))
const charCtx = inject('charCtx', {})
const values = computed(() => unref(charCtx.values) || {})
const levelAvailable = computed(() => abilityOwnerLevel(props.item.data || {}, values.value) >= Math.max(1, Number(props.item.data?.level) || 1))
const state = computed(() => entry.value?.params?.magic || {})
const active = computed(() => magicItemActive(props.item, entry.value, equipped.value, values.value))
const hasChoices = computed(() => actionableItemChoices(props.item).length > 0)
const choosing = ref(false), changingBase = ref(false)
function setBase(params) { emit('update:items', mapInventoryEntries(props.items, row => row.uid === props.uid ? { ...row, params: { ...row.params, ...params } } : row)); changingBase.value = false }
function save(patch) { emit('update:items', updateMagicItemState(props.items, props.uid, patch)) }
</script>
