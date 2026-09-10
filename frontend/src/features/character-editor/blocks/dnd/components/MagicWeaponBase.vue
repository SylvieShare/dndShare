<template>
  <FormField v-if="item.data?.weapon" label="Оружейная основа" vertical title="Основа определяет урон, свойства, дистанцию и владение. Экипированный предмет появится в блоке оружия.">
    <HandbookListItem v-if="base" :item="base" :type="{ id: 1 }" @click="!item.data.weapon.base_item_id && (open = true)" />
    <ActionButton variant="secondary" v-if="!item.data.weapon.base_item_id" type="button" @click="open = true">{{ base ? 'Изменить основу' : 'Выбрать оружие' }}</ActionButton>
    <p v-if="error" role="alert">{{ error }}</p>
  </FormField>
  <ItemPickerModal v-if="open" :item-type-ids="[1]" title="Оружейная основа" :item-eligibility="eligibility" :z-index="4800" @pick="pick" @close="open = false" />
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { ActionButton, FormField } from '@sylvieshare/share-ui'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import HandbookListItem from '@/features/items/list-components/HandbookListItem.vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { weaponBaseId } from '@/features/character-editor/lib/magicWeapons'
const props = defineProps({ item: Object, entry: Object })
const emit = defineEmits(['pick'])
const open = ref(false), base = ref(null), error = ref('')
const baseId = computed(() => weaponBaseId(props.item, props.entry))
watch(baseId, async id => {
  base.value = null; error.value = ''
  if (!id) return
  try { const result = await itemsApi.byIds([id]); if (id === baseId.value) base.value = result.items?.[0] || null }
  catch { error.value = 'Не удалось загрузить оружейную основу.' }
}, { immediate: true })
function eligibility(item) {
  const allowed = props.item.data.weapon.allowed_base_item_ids || []
  return { eligible: item.id !== 64 && (!allowed.length || allowed.map(Number).includes(Number(item.id))), reasons: ['Этот вид оружия не подходит предмету.'] }
}
function pick(item) { if (!eligibility(item).eligible) return; emit('pick', item.id); open.value = false }
</script>
