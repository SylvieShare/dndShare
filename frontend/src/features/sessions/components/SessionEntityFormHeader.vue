<template>
  <div class="entity-form-heading">
    <div v-for="field in headerFields" :key="field.key" class="entity-form-heading-field" :class="{ 'entity-form-heading-name': field.key === 'name', 'entity-form-heading-color': field.key === 'color' }"><SessionEntityFormField :field="field" header /></div>
  </div>
</template>
<script setup>
import SessionEntityFormField from './SessionEntityFormField.vue'
import { useSessionEntityForm } from '../lib/sessionEntityFormContext'
const { headerFields } = useSessionEntityForm()
</script>
<style scoped>
.entity-form-heading { min-width: 0; width: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; }
.entity-form-heading-field { display: flex; align-items: center; min-width: 0; width: min(220px, 100%); height: 32px; }
.entity-form-heading-name { flex-basis: 100%; height: 40px; --inline-edit-height: 40px; font-size: 28px; font-weight: 750; line-height: 1.15; }
.entity-form-heading-color { width: 22px; }
</style>
