<template>
  <AppModalFrame :title="title" :width="680" :z-index="zIndex" @close="!busy && $emit('close')">
    <div class="target-picker">
      <slot name="before" />
      <LoadingIndicator v-if="loading" label="Загрузка целей" />
      <div v-else class="session-target-list">
        <div v-for="target in targets" :key="impactTargetKey(target)" class="session-target-option" @click="!fixed && toggle(target, !modelValue.includes(impactTargetKey(target)))" @click.capture="selectWithCtrl($event, target)" @contextmenu.capture="selectWithCtrl($event, target)" :class="{ 'session-target-option--selected': modelValue.includes(impactTargetKey(target)) }">
          <CompactCheckbox v-if="!fixed" :size="20" :label="`Выбрать: ${target.name}`" :model-value="modelValue.includes(impactTargetKey(target))" :disabled="busy || locked || disabledKeys.includes(impactTargetKey(target))" @update:model-value="toggle(target, $event)" />
          <div class="session-target-content">
            <SaveTargetName :target="target" :icon-size="56" show-hp show-ac hp-size="medium" />
            <div v-if="$slots['target-note']" class="session-target-note"><slot name="target-note" :target="target" /></div>
          </div>
        </div>
        <p v-if="!targets.length && !error" class="target-picker-hint">В сессии пока нет доступных целей.</p>
      </div>
      <slot />
      <p v-if="error" class="target-picker-error" role="alert">{{ error }}</p>
    </div>
    <template #footer><slot name="footer" /></template>
  </AppModalFrame>
</template>
<script setup>
import { AppModalFrame, CompactCheckbox, LoadingIndicator } from '@sylvieshare/share-ui'
import { handleCtrlSelection } from '@/shared/lib/ctrlSelection'
import SaveTargetName from './SaveTargetName.vue'
import { impactTargetKey } from '../lib/sessionImpact'
const props = defineProps({
  title: { type: String, required: true },
  targets: { type: Array, default: () => [] },
  modelValue: { type: Array, default: () => [] },
  disabledKeys: { type: Array, default: () => [] },
  loading: Boolean, busy: Boolean, locked: Boolean, fixed: Boolean,
  error: String, zIndex: { type: Number, default: 3800 },
})
const emit = defineEmits(['close', 'update:modelValue'])
function selectWithCtrl(event, target) {
  const key = impactTargetKey(target)
  handleCtrlSelection(event, !props.fixed && !props.busy && !props.locked && !props.disabledKeys.includes(key), () => toggle(target, !props.modelValue.includes(key)))
}
function toggle(target, checked) {
  const key = impactTargetKey(target)
  if (props.locked || props.busy || props.disabledKeys.includes(key)) return
  emit('update:modelValue', checked ? [...new Set([...props.modelValue, key])] : props.modelValue.filter(value => value !== key))
}
</script>
<style scoped>
.target-picker { display: grid; gap: 12px; }
.session-target-list { display: grid; gap: 10px; max-height: 45vh; overflow-y: auto; }
.session-target-option { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--border); border-radius: var(--r-sm); cursor: pointer; }
.session-target-option--selected { border-color: var(--accent); }
.session-target-option > .share-compact-checkbox { margin-inline: 3px; }
.session-target-content { flex: 1; min-width: 0; }
.session-target-content > .save-target-name { width: 100%; }
.session-target-note { margin: 6px 0 0 64px; color: var(--text-muted); font-size: 12px; }
.target-picker-hint { margin: 0; color: var(--text-muted); }
.target-picker-error { margin: 0; color: var(--danger); }
</style>
