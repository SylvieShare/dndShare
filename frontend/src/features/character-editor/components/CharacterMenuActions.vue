<template>
  <div v-if="actionCount || summary || $slots.summary" class="character-menu-header"
    :class="{ 'character-menu-header--summary': summary || $slots.summary, 'character-menu-header--actions': actionCount }"
    :style="{ '--character-menu-action-count': actionCount }">
    <div v-if="summary || $slots.summary" class="character-menu-summary"><slot name="summary">{{ summary }}</slot></div>
    <span v-if="actionCount && (summary || $slots.summary)" class="character-menu-divider" role="separator" aria-orientation="vertical" />
    <div v-if="actionCount" class="character-menu-actions" role="group" aria-label="Действия с объектом">
    <ActionButton v-if="view" class="character-menu-action character-menu-action--view" layout="stacked" variant="secondary" :aria-label="viewLabel" :title="viewLabel" :disabled="viewDisabled" @click.stop="view">
      <template #icon><component :is="viewIcon" :size="18" aria-hidden="true" /></template>
      <span class="character-menu-action-label">{{ viewLabel }}</span>
    </ActionButton>
    <ActionButton v-if="edit" class="character-menu-action character-menu-action--edit" layout="stacked" variant="secondary" :aria-label="editLabel" :title="editLabel" :disabled="editDisabled" @click.stop="edit">
      <template #icon><Pencil :size="18" aria-hidden="true" /></template>
      <span class="character-menu-action-label">{{ editLabel }}</span>
    </ActionButton>
    <ActionButton v-if="remove" class="character-menu-action character-menu-action--remove" layout="stacked" variant="secondary" :aria-label="removeLabel" :title="removeLabel" :disabled="removeDisabled" @click.stop="remove">
      <template #icon><Trash2 :size="18" aria-hidden="true" /></template>
      <span class="character-menu-action-label">{{ removeLabel }}</span>
    </ActionButton>
    </div>
  </div>
</template>
<script setup>
import { ActionButton } from '@sylvieshare/share-ui'
import { Eye, Pencil, Trash2 } from '@lucide/vue'
import { computed } from 'vue'
const props = defineProps({
  summary: String,
  view: Function, edit: Function, remove: Function,
  viewDisabled: Boolean, editDisabled: Boolean, removeDisabled: Boolean,
  viewLabel: {type:String,default:'Открыть описание'},
  editLabel: {type:String,default:'Изменить'},
  removeLabel: {type:String,default:'Удалить'},
  viewIcon: {type:[Object,Function],default:()=>Eye},
})
const actionCount = computed(() => [props.view, props.edit, props.remove].filter(Boolean).length)
</script>
<style scoped>
.character-menu-header {display:flex;justify-content:flex-end;padding:var(--spacing-xs) var(--spacing-small) var(--spacing-small);box-sizing:border-box;width:100%;min-width:0;--character-menu-actions-width:calc(var(--character-menu-action-count) * var(--layout-menu-action-size) + (var(--character-menu-action-count) - 1) * var(--spacing-xs))}
.character-menu-header--summary {display:block;padding:var(--spacing-small);border-bottom:var(--layout-border) solid var(--border-strong);margin-bottom:var(--spacing-small)}
.character-menu-header--summary.character-menu-header--actions {display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:var(--spacing-label);align-items:center;min-width:min(calc(var(--layout-menu-summary-min) + var(--character-menu-actions-width) + 2 * var(--spacing-label) + 2 * var(--spacing-small) + var(--layout-border)), calc(100vw - 2 * var(--spacing-large) - 2 * var(--spacing-small)))}
.character-menu-summary {min-width:0;overflow-wrap:anywhere;color:var(--text-1)}
.character-menu-divider {width:var(--layout-border);align-self:stretch;background:var(--border-strong)}
.character-menu-actions {display:grid;grid-template-columns:repeat(var(--character-menu-action-count),minmax(0,1fr));gap:var(--spacing-xs);width:min(100%,var(--character-menu-actions-width));min-width:0}
.character-menu-header--summary .character-menu-actions {width:var(--character-menu-actions-width)}
.character-menu-action {--action-button-height:var(--layout-menu-action-size);--action-button-bg:var(--surface-active);--action-button-hover-bg:color-mix(in srgb,var(--action-button-fg) 7%,var(--surface-active));--action-button-hover-fg:var(--action-button-fg)}
.character-menu-action-label {display:block;max-width:100%;overflow-wrap:anywhere;text-wrap:balance;color:var(--text-1)}
.character-menu-action--view {--action-button-fg:color-mix(in srgb,var(--info) 88%,var(--text-1))}
.character-menu-action--edit {--action-button-fg:var(--warning)}
.character-menu-action--remove {--action-button-fg:color-mix(in srgb,var(--danger) 75%,var(--text-1))}
</style>
