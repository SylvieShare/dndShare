<template>
  <div class="ability-action-fields">
    <FormField label="Уровень для расчётов" vertical title="Этот источник уровня используют урон, прогрессия, ресурс и панель способности. Отсутствующий класс не заменяется общим уровнем.">
      <span v-if="readonly">{{ sourceLabel }}</span>
      <FormSelect v-else :value="data.level_source || 'bound'" aria-label="Уровень для расчётов" @update:value="changeSource">
        <option value="bound">По привязке способности</option>
        <option value="class">Определённый класс</option>
        <option value="character">Общий уровень персонажа</option>
      </FormSelect>
    </FormField>
    <AbilityRuleFields v-if="!readonly && data.level_source === 'class'" :fields="classFields" :data="data" @update:data="value => Object.assign(data, value)" />
    <FormField v-else-if="!readonly && (!data.level_source || data.level_source === 'bound')" label="Источник" vertical title="Если указано несколько классов, берётся наибольший уровень подходящего. Без привязки — уровень персонажа."><span>{{ sourceLabel }}</span></FormField>
  </div>
</template>
<script setup>
import { computed, inject, onScopeDispose, watch, watchEffect } from 'vue'
import { FormField, FormSelect } from '@sylvieshare/share-ui'
import { abilityLevelSourceLabel } from '@/shared/lib/abilityLevelSource'
import { ensureItemNames, itemName } from '@/features/handbook/objects/lib/itemNames'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import AbilityRuleFields from './AbilityRuleFields.vue'
const props = defineProps({ data: { type: Object, required: true }, readonly: Boolean })
const editor = inject(itemFieldEditorKey, {})
const sourceLabel = computed(() => abilityLevelSourceLabel(props.data, id => itemName(id) || `#${id}`))
const classFields = [{ key: 'level_class_id', type: 'item', item_type: 9, name: 'Класс для расчётов', hint: 'Выберите класс. Уровни остальных классов не добавляются.' }]
watch(() => [props.data.level_class_id, ...(props.data.class_ids || []), ...(props.data.subclass_ids || [])].map(row => row?.id ?? row).filter(Boolean), ids => { ensureItemNames(ids).catch(() => {}) }, { immediate: true })
function changeSource(value) {
  props.data.level_source = value
  if (value === 'class') props.data.level_class_id = props.data.class_ids?.[0]?.id ?? props.data.class_ids?.[0] ?? null
  else delete props.data.level_class_id
}
const validationKey = Symbol('level-source')
watchEffect(() => { if (!props.readonly) editor.setValidationError?.(validationKey, props.data.level_source === 'class' && !props.data.level_class_id ? 'Выберите класс для расчётов способности.' : '') })
onScopeDispose(() => { if (!props.readonly) editor.setValidationError?.(validationKey, '') })
</script>
