<template>
  <div v-if="block.title" class="input-text-row">
    <span class="input-text-label">{{ block.title }}</span>
    <input
      v-if="editing"
      ref="inputEl"
      class="input-text"
      :class="{ 'input-outlined': focused || !value, 'input-empty': !value }"
      :style="block.content.color ? { color: block.content.color } : {}"
      :value="value"
      :placeholder="block.content.placeholder"
      spellcheck="false"
      @focus="focused = true"
      @blur="stopEdit"
      @input="$emit('update:value', block.id, $event.target.value)"
    />
    <template v-else>
      <span
        class="input-text input-text-view"
        :class="{ 'input-text-empty': !value, 'input-text-view--owner': owner }"
        :style="block.content.color && value ? { color: block.content.color } : {}"
        @click="startEdit"
      >{{ value || (owner ? block.content.placeholder : '') }}</span>
      <button v-if="owner" class="field-edit-btn" type="button" title="Редактировать" @click="startEdit">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
    </template>
  </div>

  <div v-else class="input-text-wrap">
    <input
      v-if="editing"
      ref="inputEl"
      class="input-text"
      :class="{ 'input-outlined': focused || !value, 'input-empty': !value }"
      :style="block.content.color ? { color: block.content.color } : {}"
      :value="value"
      :placeholder="block.content.placeholder"
      spellcheck="false"
      @focus="focused = true"
      @blur="stopEdit"
      @input="$emit('update:value', block.id, $event.target.value)"
    />
    <template v-else>
      <span
        class="input-text input-text-view"
        :class="{ 'input-text-empty': !value, 'input-text-view--owner': owner }"
        :style="block.content.color && value ? { color: block.content.color } : {}"
        @click="startEdit"
      >{{ value || (owner ? block.content.placeholder : '') }}</span>
      <button v-if="owner" class="field-edit-btn" type="button" title="Редактировать" @click="startEdit">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, ref } from 'vue'

defineProps(['block', 'value'])
defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true, dictionaries: {}, var: {} })
const focused = ref(false)
const editOn = ref(false)
const inputEl = ref(null)

const owner = computed(() => !!charCtx.ownerMode)
const editing = computed(() => owner.value && editOn.value)

function startEdit() {
  if (!owner.value) return
  editOn.value = true
  nextTick(() => inputEl.value?.focus())
}

function stopEdit() {
  focused.value = false
  editOn.value = false
}
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

.input-text-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
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

.input-text-view {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  white-space: pre-wrap;
  word-break: break-word;
}
.input-text-view--owner { cursor: text; }
.input-text-empty { color: var(--text-muted); }

.input-outlined {
  padding-left: 8px;
  padding-right: 8px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--text-on-accent) 15%, transparent), 0 0 8px color-mix(in srgb, var(--text-on-accent) 5%, transparent);
}

.input-outlined.input-empty {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--danger) 40%, transparent), 0 0 8px color-mix(in srgb, var(--danger) 20%, transparent);
}

.field-edit-btn {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.35;
  transition: color 0.15s, opacity 0.15s;
}
@media (hover: hover) {
  .input-text-row:hover .field-edit-btn,
  .input-text-wrap:hover .field-edit-btn { color: var(--accent); opacity: 1; }
}
.field-edit-btn:focus-visible { color: var(--accent); opacity: 1; }
</style>
