<template>
  <div class="entity-form-heading">
    <SessionEntityFormField v-for="field in headerFields" :key="field.key" :field="field" header :class="{ 'entity-form-heading-name': field.key === 'name' }" />
  </div>
</template>
<script setup>
import SessionEntityFormField from './SessionEntityFormField.vue'
import { useSessionEntityForm } from '../lib/sessionEntityFormContext'
const { headerFields } = useSessionEntityForm()
</script>
<style scoped>
.entity-form-heading { min-width: 0; width: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; }
.entity-form-heading-name { flex-basis: 100%; }
</style>
