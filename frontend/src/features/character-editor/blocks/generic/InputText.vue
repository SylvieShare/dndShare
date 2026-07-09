<template>
  <div v-if="block.title" class="input-text-row">
    <span class="input-text-label">{{ block.title }}</span>
    <input
      class="input-text"
      :class="{ 'input-outlined': focused || (!value && charCtx.editMode), 'input-empty': !value && charCtx.editMode }"
      :style="block.content.color ? { color: block.content.color } : {}"
      :value="value"
      :placeholder="charCtx.editMode ? block.content.placeholder : ''"
      :readonly="!charCtx.editMode"
      spellcheck="false"
      @focus="focused = true"
      @blur="focused = false"
      @input="$emit('update:value', block.id, $event.target.value)"
    />
  </div>
  <input
    v-else
    class="input-text"
    :class="{ 'input-outlined': focused || (!value && charCtx.editMode), 'input-empty': !value && charCtx.editMode }"
    :style="block.content.color ? { color: block.content.color } : {}"
    :value="value"
    :placeholder="charCtx.editMode ? block.content.placeholder : ''"
    :readonly="!charCtx.editMode"
    spellcheck="false"
    @focus="focused = true"
    @blur="focused = false"
    @input="$emit('update:value', block.id, $event.target.value)"
  />
</template>

<script setup>
import { inject, ref } from 'vue'

defineProps(['block', 'value'])
defineEmits(['update:value'])
const charCtx = inject('charCtx', { editMode: true, ownerMode: false, dictionaries: {}, var: {} })
const focused = ref(false)
</script>

<style scoped>
.input-text-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--border);
}

.input-text-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--text-2);
  white-space: nowrap;
  flex-shrink: 0;
}

.input-text-row .input-text {
  border-radius: 0;
  border-bottom: none;
  padding: 4px 0;
  font-size: 15px;
}

.input-text {
  background: transparent;
  border: none;
  outline: none;
  font-size: 20px;
  font-family: inherit;
  color: var(--text-1);
  width: 100%;
  padding: 4px 0;
  border-radius: 6px;
  transition: box-shadow 0.15s ease, padding-left 0.15s ease;
}

.input-text::placeholder {
  color: var(--text-muted);
}

.input-outlined {
  padding-left: 8px;
  padding-right: 8px;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15), 0 0 8px rgba(255, 255, 255, 0.05);
}

.input-outlined.input-empty {
  box-shadow: 0 0 0 1px rgba(220, 80, 80, 0.4), 0 0 8px rgba(220, 80, 80, 0.2);
}
</style>
