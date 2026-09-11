<template>
  <div class="ability-action-fields">
    <AbilityRuleFields :fields="fields.filter(f => f.key !== 'damage')" :data="data" @update:data="update" />
    <FormField label="Добавляет урон по цели" title="Одна галочка связывает преимущество атаки и кости урона. Крит удваивает только кости."><ToggleSwitch :model-value="!!data.damage" aria-label="Добавляет урон по цели" @update:model-value="value => value ? data.damage = { dice: 'd6', dice_count: 1 } : delete data.damage" /></FormField>
    <AbilityRuleFields v-if="data.damage" :fields="fields.find(f => f.key === 'damage').fields" :data="data.damage" @update:data="value => Object.assign(data.damage, value)" />
  </div>
</template>
<script setup>
import { inject, watchEffect, onScopeDispose } from 'vue'
import { FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { selectedTargetRuleError } from '@/features/character-editor/lib/selectedTarget'
import AbilityRuleFields from './AbilityRuleFields.vue'
const props = defineProps({ data: Object, fields: Array })
const editor = inject(itemFieldEditorKey, {}), validationKey = Symbol('selected-target')
watchEffect(() => editor.setValidationError?.(validationKey, selectedTargetRuleError(props.data) || (!editor.itemData?.weapon ? 'Для выбранной цели укажите оружейную основу предмета.' : '')))
onScopeDispose(() => editor.setValidationError?.(validationKey, ''))
function update(value) { Object.assign(props.data, value) }
</script>
