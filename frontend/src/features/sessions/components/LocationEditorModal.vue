<template>
  <AppModalFrame extra-wide :title="location ? 'Редактировать локацию' : 'Новая локация'" @close="$emit('close')">
    <SessionEntityForm
      type="location"
      :entity="location"
      :locations="locations"
      :relation-items="relationItems"
      :defaults="{ parentId: defaultParentId }"
      editable
      editing
      :saving="saving"
      :save="payload => $emit('save', payload)"
      @cancel="$emit('close')"
    />
    <template v-if="location" #footer>
      <button type="button" class="entity-editor-delete" :disabled="saving" @click="$emit('delete', location)">Удалить локацию</button>
    </template>
  </AppModalFrame>
</template>
<script setup>
import { AppModalFrame } from '@sylvieshare/share-ui'
import SessionEntityForm from './SessionEntityForm.vue'
defineProps({
  location: { type: Object, default: null },
  locations: { type: Array, default: () => [] },
  relationItems: { type: Array, default: () => [] },
  saving: Boolean,
  defaultParentId: { type: [Number, String], default: null },
  defaultLocationId: { type: [Number, String], default: null },
})
defineEmits(['close', 'save', 'delete'])
</script>
<style scoped>
.entity-editor-delete { border: 0; background: transparent; color: var(--danger); font: inherit; cursor: pointer; }
</style>
