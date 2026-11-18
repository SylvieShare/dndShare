<template>
  <div v-if="actionCount || summary || $slots.summary" class="character-menu-header"
    :data-action-menu-size="actionCount && !summary && !$slots.summary ? 'content' : undefined"
    :class="{ 'character-menu-header--summary': summary || $slots.summary, 'character-menu-header--actions': actionCount }"
    :style="{ '--character-menu-action-count': actionCount }">
    <div v-if="summary || $slots.summary" class="character-menu-summary"><slot name="summary">{{ summary }}</slot></div>
    <span v-if="actionCount && (summary || $slots.summary)" class="character-menu-divider" role="separator" aria-orientation="vertical" />
    <div v-if="actionCount" ref="actions" class="character-menu-actions" role="group" aria-label="Действия с объектом">
    <ActionButton v-if="view" class="character-menu-action character-menu-action--view" layout="stacked" variant="secondary" :aria-label="viewLabel" :title="viewLabel" :disabled="viewDisabled" @click.stop="view">
      <template #icon><component :is="viewIcon" :size="layoutTokens['sheet-header-action-icon']" aria-hidden="true" /></template>
      <span class="character-menu-action-label">{{ viewCaption || viewLabel }}</span>
    </ActionButton>
    <ActionButton v-if="edit" class="character-menu-action character-menu-action--edit" layout="stacked" variant="secondary" :aria-label="editLabel" :title="editLabel" :disabled="editDisabled" @click.stop="edit">
      <template #icon><Pencil :size="layoutTokens['sheet-header-action-icon']" aria-hidden="true" /></template>
      <span class="character-menu-action-label">{{ editLabel }}</span>
    </ActionButton>
    <ActionButton v-if="remove" class="character-menu-action character-menu-action--remove" layout="stacked" variant="secondary" :aria-label="removeLabel" :title="removeLabel" :disabled="removeDisabled" @click.stop="remove">
      <template #icon><Trash2 :size="layoutTokens['sheet-header-action-icon']" aria-hidden="true" /></template>
      <span class="character-menu-action-label">{{ removeLabel }}</span>
    </ActionButton>
    </div>
  </div>
</template>
<script setup>
import { ActionButton } from '@sylvieshare/share-ui'
import { Eye, Pencil, Trash2 } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, onUpdated, ref, watch } from 'vue'
import { layoutTokens } from '@/app/design-tokens'
const props = defineProps({
  summary: String,
  view: Function, edit: Function, remove: Function,
  viewDisabled: Boolean, editDisabled: Boolean, removeDisabled: Boolean,
  viewLabel: {type:String,default:'Открыть описание'},
  viewCaption: String,
  editLabel: {type:String,default:'Изменить'},
  removeLabel: {type:String,default:'Удалить'},
  viewIcon: {type:[Object,Function],default:()=>Eye},
})
const actionCount = computed(() => [props.view, props.edit, props.remove].filter(Boolean).length)
const actions = ref(null)
let observer, frame

function fitLabels() {
  for (const label of actions.value?.querySelectorAll('.character-menu-action-label') || []) {
    label.style.removeProperty('font-size')
    if (!label.clientWidth) continue
    let fontSize = parseFloat(getComputedStyle(label).fontSize)
    while (fontSize > 1 && (label.scrollWidth > label.clientWidth
      || label.scrollHeight > 2 * parseFloat(getComputedStyle(label).lineHeight) + .5)) {
      fontSize -= .5
      label.style.fontSize = `${fontSize}px`
    }
  }
}

function scheduleFit() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(fitLabels)
}

watch(actions, group => {
  observer?.disconnect()
  if (group) {
    observer ??= new ResizeObserver(scheduleFit)
    observer.observe(group)
  }
  scheduleFit()
}, { flush: 'post' })
onUpdated(scheduleFit)
onMounted(() => document.fonts?.addEventListener('loadingdone', scheduleFit))
onBeforeUnmount(() => {
  observer?.disconnect()
  document.fonts?.removeEventListener('loadingdone', scheduleFit)
  cancelAnimationFrame(frame)
})
</script>
<style scoped>
.character-menu-header {display:flex;justify-content:flex-end;padding:var(--spacing-xs) var(--spacing-small) var(--spacing-small);box-sizing:border-box;width:100%;min-width:0;--character-menu-actions-width:calc(var(--character-menu-action-count) * var(--layout-menu-action-size) + (var(--character-menu-action-count) - 1) * var(--spacing-xs))}
.character-menu-header--summary {display:block;padding:var(--spacing-small);border-bottom:var(--layout-border) solid var(--border-strong);margin-bottom:var(--spacing-small)}
.character-menu-header--summary.character-menu-header--actions {display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,max-content);gap:var(--spacing-label);align-items:center;min-width:min(calc(var(--layout-menu-summary-min) + var(--character-menu-actions-width) + 2 * var(--spacing-label) + 2 * var(--spacing-small) + var(--layout-border)), calc(100vw - 2 * var(--spacing-large) - 2 * var(--spacing-small)))}
.character-menu-summary {min-width:0;overflow-wrap:anywhere;color:var(--text-1)}
.character-menu-divider {width:var(--layout-border);align-self:stretch;background:var(--border-strong)}
.character-menu-actions {display:grid;grid-template-columns:repeat(var(--character-menu-action-count),minmax(0,1fr));gap:var(--spacing-xs);width:var(--character-menu-actions-width);max-width:100%;min-width:0}
.character-menu-actions .character-menu-action {
  --action-button-height:var(--layout-menu-action-size);
  --action-button-bg:var(--surface-active);
  --action-button-hover-bg:color-mix(in srgb,var(--action-button-fg) 7%,var(--surface-active));
  --action-button-hover-fg:var(--action-button-fg);
  align-items:stretch;
  min-inline-size:0;
  padding-inline:var(--spacing-xs);
}
.character-menu-action > :deep(svg) { align-self:center; }
.character-menu-action-label {
  display:block;
  max-width:100%;
  color:var(--text-1);
  line-height:1.2;
  text-align:center;
  text-wrap:balance;
  word-break:normal;
  overflow-wrap:normal;
  hyphens:none;
}
.character-menu-action--view {--action-button-fg:color-mix(in srgb,var(--info) 88%,var(--text-1))}
.character-menu-action--edit {--action-button-fg:var(--warning)}
.character-menu-action--remove {--action-button-fg:color-mix(in srgb,var(--danger) 75%,var(--text-1))}
</style>
