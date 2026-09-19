<template>
  <details class="ability-advanced" open>
    <summary>Редакции правил</summary>
    <div v-for="version in versions" :key="version.id" class="ability-action-fields">
      <FormField :label="version.version" vertical>
        <FormSelect :value="decision(version.id)?.status || ''" @update:value="setStatus(version.id, $event)">
          <option value="">Не проверено</option>
          <option v-for="status in COMPATIBILITY_STATUSES" :key="status.value" :value="status.value">{{ status.label }}</option>
        </FormSelect>
      </FormField>
      <button v-if="itemId" type="button" class="ability-link" :disabled="creating" @click="createVariant(version.id)">Создать отдельный вариант {{ version.version }}</button>
      <template v-if="decision(version.id)">
        <FormField v-if="decision(version.id).status === 'legacy'" label="Новая версия" vertical>
          <button type="button" class="ability-link" @click="replacementVersion = version">
            {{ replacementNames[decision(version.id).replacedByItemId] || 'Выбрать замену' }}
          </button>
          <button v-if="decision(version.id).replacedByItemId" type="button" class="ability-link" @click="patch(version.id, { replacedByItemId: null })">Снять замену</button>
        </FormField>
        <FormField label="Пояснение" vertical>
          <FormTextarea :value="decision(version.id).note || ''" :maxlength="1000" @update:value="patch(version.id, { note: $event })" />
        </FormField>
      </template>
    </div>
    <FormField v-if="itemId" label="Тип нового варианта" vertical><FormSelect v-model:value="variantKind"><option value="revision">Новая версия правил</option><option value="adaptation">Адаптация</option></FormSelect></FormField>
    <p v-if="error" role="alert">{{ error }}</p>
    <ItemPickerModal v-if="replacementVersion" :item-type-ids="[typeId]" :source-version-id="replacementVersion.id"
      :exclude-items="itemId ? [itemId] : []" :z-index="zIndex + 500" title="Новая версия объекта"
      @pick="chooseReplacement" @close="replacementVersion = null" />
  </details>
</template>
<script setup>
import { defineAsyncComponent, ref, watch } from 'vue'
import { FormField, FormSelect, FormTextarea } from '@sylvieshare/share-ui'
import { COMPATIBILITY_STATUSES } from '@/shared/lib/itemCompatibility'
import { fetchPost } from '@/shared/api/http'
import { itemsApi } from '@/shared/api/itemsApi'
const ItemPickerModal = defineAsyncComponent(() => import('@/features/handbook/components/ItemPickerModal.vue'))
const props = defineProps({ modelValue: { type: Array, default: () => [] }, versions: { type: Array, default: () => [] }, typeId: Number, itemId: Number, zIndex: Number })
const emit = defineEmits(['update:modelValue', 'variant'])
const variantKind = ref('adaptation')
const creating = ref(false), error = ref('')
async function createVariant(sourceVersionId) {
  creating.value = true; error.value = ''
  try { emit('variant', await fetchPost(`/items/${props.itemId}/variant`, { sourceVersionId, kind: variantKind.value })) }
  catch (e) { error.value = e.message || 'Не удалось создать вариант' }
  finally { creating.value = false }
}
const replacementVersion = ref(null)
const replacementNames = ref({})
const decision = id => props.modelValue.find(row => Number(row.sourceVersionId) === Number(id))
function patch(id, values) {
  emit('update:modelValue', props.modelValue.map(row => Number(row.sourceVersionId) === Number(id) ? { ...row, ...values } : row))
}
function setStatus(id, status) {
  const others = props.modelValue.filter(row => Number(row.sourceVersionId) !== Number(id))
  emit('update:modelValue', status ? [...others, { sourceVersionId: id, status, note: decision(id)?.note || '', ...(status === 'legacy' && decision(id)?.replacedByItemId ? { replacedByItemId: decision(id).replacedByItemId } : {}) }] : others)
}
function chooseReplacement(item) {
  replacementNames.value[item.id] = item.name
  patch(replacementVersion.value.id, { replacedByItemId: item.id })
  replacementVersion.value = null
}
watch(() => props.modelValue.map(row => row.replacedByItemId).filter(Boolean).join(','), async (ids, _, cleanup) => {
  let stale = false
  cleanup(() => { stale = true })
  if (!ids) return
  try {
    const response = await itemsApi.byIds(ids.split(','))
    if (!stale) for (const item of response.items || []) replacementNames.value[item.id] = item.name
  } catch { /* Stored references remain intact; the picker allows retry. */ }
}, { immediate: true })
</script>

