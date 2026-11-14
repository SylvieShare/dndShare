<template>
  <div v-if="view || edit || remove" class="character-menu-actions" role="group" aria-label="Действия с объектом">
    <ActionButton v-if="view" class="character-menu-action character-menu-action--view" icon-only variant="secondary" :aria-label="viewLabel" :title="viewLabel" :disabled="viewDisabled" @click.stop="view">
      <template #icon><component :is="viewIcon" :size="18" aria-hidden="true" /></template>
    </ActionButton>
    <ActionButton v-if="edit" class="character-menu-action character-menu-action--edit" icon-only variant="secondary" :aria-label="editLabel" :title="editLabel" :disabled="editDisabled" @click.stop="edit">
      <template #icon><Pencil :size="18" aria-hidden="true" /></template>
    </ActionButton>
    <ActionButton v-if="remove" class="character-menu-action character-menu-action--remove" icon-only variant="secondary" :aria-label="removeLabel" :title="removeLabel" :disabled="removeDisabled" @click.stop="remove">
      <template #icon><Trash2 :size="18" aria-hidden="true" /></template>
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
.character-menu-action {--action-button-bg:var(--surface-active);--action-button-hover-bg:color-mix(in srgb,var(--action-button-fg) 7%,var(--surface-active));--action-button-hover-fg:var(--action-button-fg)}
.character-menu-action--view {--action-button-fg:color-mix(in srgb,var(--info) 88%,var(--text-1))}
.character-menu-action--edit {--action-button-fg:var(--warning)}
.character-menu-action--remove {--action-button-fg:color-mix(in srgb,var(--danger) 75%,var(--text-1))}
</style>
