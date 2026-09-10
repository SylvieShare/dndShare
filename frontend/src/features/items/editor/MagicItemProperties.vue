<template>
  <CatalogueFields :fields="profile.primary" :data="data" :type-id="19" :root-data="data" @update:data="update" />
  <details v-for="group in profile.groups" :key="group.key" class="ability-advanced">
    <summary>{{ group.name }}</summary>
    <CatalogueFields :fields="group.fields" :data="data" :type-id="19" :root-data="data" @update:data="update" />
  </details>
</template>
<script setup>
import { computed, inject, onScopeDispose, watchEffect } from 'vue'
import CatalogueFields from './catalogue/CatalogueFields.vue'
import { catalogueProfile } from './catalogue/catalogueProfiles'
import { catalogueValidation } from './catalogue/catalogueValidation'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
const props = defineProps({ fields: Array, data: Object })
const profile = computed(() => catalogueProfile(19, props.fields))
function update(value) {
  for (const key of Object.keys(props.data)) if (!(key in value)) delete props.data[key]
  Object.assign(props.data, value)
}
const editor = inject(itemFieldEditorKey, {}), validationKey = Symbol('magic-item')
watchEffect(() => editor.setValidationError?.(validationKey, catalogueValidation(props.fields, props.data, 19).slice(0, 3).join(' ')))
onScopeDispose(() => editor.setValidationError?.(validationKey, ''))
</script>
