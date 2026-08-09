<template>
  <textarea
    class="form-textarea"
    :value="value"
    :placeholder="placeholder"
    :rows="rows"
    :maxlength="maxlength"
    @input="$emit('update:value', $event.target.value)"
  />
</template>

<script setup>
defineProps({
  value:       { default: '' },
  placeholder: { type: String, default: '' },
  rows:        { type: Number, default: 3 },
  maxlength:   { default: undefined },
})
defineEmits(['update:value'])
</script>

<style scoped>
.form-textarea {
  background: var(--surface-raised);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  outline: none;
  resize: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.form-textarea:focus { border-color: var(--accent); }
.form-textarea::placeholder { color: var(--text-muted); }
</style>
