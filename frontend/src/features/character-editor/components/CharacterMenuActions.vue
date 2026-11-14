<template>
  <div v-if="view || edit || remove" class="character-menu-actions" role="group" aria-label="Действия с объектом">
    <ActionButton v-if="view" icon-only variant="secondary" :aria-label="viewLabel" :title="viewLabel" :disabled="viewDisabled" @click.stop="view">
      <template #icon><component :is="viewIcon" :size="18" aria-hidden="true" /></template>
    </ActionButton>
    <ActionButton v-if="edit" icon-only variant="secondary" :aria-label="editLabel" :title="editLabel" :disabled="editDisabled" @click.stop="edit">
      <template #icon><Pencil :size="18" aria-hidden="true" /></template>
    </ActionButton>
    <ActionButton v-if="remove" icon-only variant="secondary" :aria-label="removeLabel" :title="removeLabel" :disabled="removeDisabled" @click.stop="remove">
      <template #icon><Trash2 class="character-menu-actions__danger" :size="18" aria-hidden="true" /></template>
    </ActionButton>
  </div>
</template>
<script setup>
import { ActionButton } from '@sylvieshare/share-ui'
import { Eye, Pencil, Trash2 } from '@lucide/vue'
defineProps({
  view: Function, edit: Function, remove: Function,
  viewDisabled: Boolean, editDisabled: Boolean, removeDisabled: Boolean,
  viewLabel: {type:String,default:'Открыть описание'},
  editLabel: {type:String,default:'Изменить'},
  removeLabel: {type:String,default:'Удалить'},
  viewIcon: {type:[Object,Function],default:()=>Eye},
})
</script>
<style scoped>
.character-menu-actions {display:flex;justify-content:flex-end;align-items:center;gap:var(--spacing-xs);padding:var(--spacing-xs) var(--spacing-small) var(--spacing-small);box-sizing:border-box;width:100%;--action-button-icon-size:var(--layout-menu-action-size)}
.character-menu-actions__danger {color:var(--danger)}
</style>
