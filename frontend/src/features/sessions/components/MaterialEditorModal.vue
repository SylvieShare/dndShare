<template>
  <AppModalFrame extra-wide :title="material ? 'Редактировать материал' : 'Новый материал'" @close="$emit('close')">
    <SessionEntityForm
      type="material"
      :entity="material"
      :locations="locations"
      :relation-items="relationItems"

      editable
      editing
      :saving="saving"
      :save="payload => $emit('save', payload)"
      @cancel="$emit('close')"
    />
    <template v-if="material" #footer>
      <button type="button" class="entity-editor-delete" :disabled="saving" @click="$emit('delete', material)">Удалить материал</button>
    </template>
  </AppModalFrame>
</template>
<script setup>
import { AppModalFrame } from '@sylvieshare/share-ui'
import SessionEntityForm from './SessionEntityForm.vue'
defineProps({
  material: { type: Object, default: null },
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
