<template>
  <div class="death-save-tile" :class="{ 'death-save-editable': charCtx.editMode || charCtx.ownerMode }">
    <div class="death-save-head">
      <div class="death-save-title">{{ title }}</div>
    </div>

    <button class="death-save-row success" type="button" :disabled="!charCtx.editMode && !charCtx.ownerMode" @click="noop">
      <span class="death-save-label">Успехи</span>
      <span class="death-save-track">
        <span
          v-for="index in 3"
          :key="`success-${index}`"
          class="death-save-mark"
          :class="{ filled: index <= state.success }"
          @click.stop="setCount('success', index)"
        ></span>
      </span>
    </button>

    <button class="death-save-row failure" type="button" :disabled="!charCtx.editMode && !charCtx.ownerMode" @click="noop">
      <span class="death-save-label">Провалы</span>
      <span class="death-save-track">
        <span
          v-for="index in 3"
          :key="`failure-${index}`"
          class="death-save-mark"
          :class="{ filled: index <= state.failure }"
          @click.stop="setCount('failure', index)"
        ></span>
      </span>
    </button>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { editMode: true, ownerMode: false, dictionaries: {}, var: {} })
const title = computed(() => props.block.title || 'Death Save')
const state = computed(() => {
  const success = normalizeCount(props.value?.success ?? props.value?.successes ?? 0)
  const failure = normalizeCount(props.value?.failure ?? props.value?.failures ?? 0)
  return { success, failure }
})

function noop() {}

function normalizeCount(value) {
  return Math.max(0, Math.min(3, parseInt(value) || 0))
}

function setCount(type, index) {
  if (!charCtx.editMode && !charCtx.ownerMode) return
  const current = state.value[type]
  const next = current === index ? index - 1 : index
  emit('update:value', props.block.id, {
    success: type === 'success' ? next : state.value.success,
    failure: type === 'failure' ? next : state.value.failure,
  })
}
</script>

<style scoped>
.death-save-tile {
  width: 140px;
  min-height: 100px;
  background-color: #2a2a2e;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
}

.death-save-head {
  display: flex;
  align-items: baseline;
}

.death-save-title {
  color: #d8d8db;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.1;
}

.death-save-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  text-align: left;
}

.death-save-row:disabled {
  cursor: default;
}

.death-save-label {
  color: var(--text-muted);
  font-size: 11px;
  min-width: 52px;
}

.death-save-track {
  display: flex;
  gap: 6px;
}

.death-save-mark {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid #4a4a52;
  background-color: #202025;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.45);
  transition: transform 0.15s ease, border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

.success .death-save-mark.filled {
  background-color: var(--success);
  border-color: #67c584;
  box-shadow: 0 0 10px rgba(76, 175, 110, 0.28);
}

.failure .death-save-mark.filled {
  background-color: var(--danger-dim);
  border-color: #df766f;
  box-shadow: 0 0 10px rgba(201, 90, 82, 0.26);
}

.death-save-editable .death-save-row {
  cursor: default;
}

.death-save-editable .death-save-mark {
  cursor: pointer;
}
</style>
