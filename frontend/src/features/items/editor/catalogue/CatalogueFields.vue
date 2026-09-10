<template>
  <div class="ability-rule-fields">
    <CatalogueField v-for="field in visibleFields" :key="field.key" :field="field" :data="data" :type-id="typeId" :root-data="rootData" :path="path ? `${path}.${field.key}` : field.key" :hide-label="field.key === hideLabelFor" @update:model-value="value => $emit('update:data', updateCatalogueValue(data, field, value, path ? `${path}.${field.key}` : field.key, typeId))" />
  </div>
</template>
<script setup>
import { computed } from 'vue'
import CatalogueField from './CatalogueField.vue'
import { catalogueFieldVisible, updateCatalogueValue } from './catalogueFields'
const props = defineProps({ fields: Array, data: { type: Object, default: () => ({}) }, typeId: Number, rootData: Object, path: { type: String, default: '' }, hideLabelFor: String })
defineEmits(['update:data'])
const visibleFields = computed(() => (props.fields || []).filter(f => !f.readonly && catalogueFieldVisible(f, props.data, props.typeId, props.path ? `${props.path}.${f.key}` : f.key, props.rootData)))
</script>
