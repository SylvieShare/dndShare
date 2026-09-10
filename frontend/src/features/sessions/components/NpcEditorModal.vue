<template>
  <AppModalFrame extra-wide :title="npc ? 'Редактировать NPC' : 'Новый NPC'" @close="$emit('close')">
    <SessionEntityForm
      type="npc"
      :entity="npc"
      :locations="locations"
      :relation-items="relationItems"
      :defaults="{ locationId: defaultLocationId }"
      editable
      editing
      :saving="saving"
      :save="payload => $emit('save', payload)"
      @cancel="$emit('close')"
    />
    <template v-if="npc" #footer>
      <button type="button" class="entity-editor-delete" :disabled="saving" @click="$emit('delete', npc)">Удалить NPC</button>
    </template>
  </AppModalFrame>
</template>
<script setup>
import { AppModalFrame } from '@sylvieshare/share-ui'
import SessionEntityForm from './SessionEntityForm.vue'
defineProps({
  npc: { type: Object, default: null },
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
