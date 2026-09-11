<template>
  <div class="ability-action-fields">
    <AbilityRuleFields :fields="fieldsFor(['title'])" :data="data" @update:data="update" />
    <RuleKeyField v-model="data.key" :title="data.title" :used-keys="otherKeys" />
    <AbilityRuleFields :fields="fieldsFor(['description', 'requirements', 'confirm_label'])" :data="data" @update:data="update" />
    <FormField v-if="resources.length > 1 || missingResource" label="Какой ресурс расходуется" title="Выберите ресурс данного экземпляра. Он списывается только при подтверждении результата." vertical>
      <FormSelect :value="data.resource_key || ''" aria-label="Какой ресурс расходуется" @update:value="value => data.resource_key = value || undefined">
        <option v-if="missingResource" disabled :value="data.resource_key || ''">Добавьте и выберите ресурс</option>
        <option v-for="row in resources" :key="row.key" :value="row.key">{{ row.title }}</option>
      </FormSelect>
    </FormField>
    <AbilityRuleFields :fields="fieldsFor(['resource_cost'])" :data="data" @update:data="update" />
  </div>
</template>
<script setup>
import { computed, inject, onScopeDispose, watch, watchEffect } from 'vue'
import { FormField, FormSelect } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { confirmedItemUseError } from '@/features/character-editor/lib/confirmedItemUses'
import { itemResourceOptions } from './itemResourceOptions'
import AbilityRuleFields from './AbilityRuleFields.vue'
import RuleKeyField from './RuleKeyField.vue'
const props = defineProps({ data: Object, fields: Array })
const editor = inject(itemFieldEditorKey, {}), validationKey = Symbol('confirmed-use')
const resources = computed(() => itemResourceOptions(editor.itemData))
const missingResource = computed(() => !resources.value.some(row => row.key === (props.data.resource_key || '')))
const otherKeys = computed(() => (editor.itemData?.confirmed_uses || []).filter(row => row !== props.data).map(row => row.key))
const fieldsFor = keys => keys.map(key => props.fields.find(field => field.key === key)).filter(Boolean)
watch(resources, rows => { if (rows.length === 1 && !props.data.resource_key) props.data.resource_key = rows[0].key || undefined }, { immediate: true })
watchEffect(() => editor.setValidationError?.(validationKey, confirmedItemUseError(props.data) || (otherKeys.value.includes(props.data.key) ? 'Ключи применений не должны повторяться.' : '') || (missingResource.value ? 'Добавьте и выберите ресурс применения.' : '')))
onScopeDispose(() => editor.setValidationError?.(validationKey, ''))
function update(value) { Object.assign(props.data, value) }
</script>
