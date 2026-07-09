<template>
  <button
    type="button"
    class="enc-cb"
    :class="{ 'enc-cb--checked': modelValue, 'enc-cb--disabled': disabled }"
    :disabled="disabled"
    :aria-checked="modelValue ? 'true' : 'false'"
    role="checkbox"
    @click.stop="onClick"
    @pointerdown.stop
  >
    <svg v-if="modelValue" class="enc-cb-tick" width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6.2l2.4 2.4 4.6-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

function onClick() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped>
.enc-cb {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 9px;
  margin: -9px;
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  box-sizing: content-box;
  width: 18px;
  height: 18px;
  position: relative;
}
.enc-cb::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 18px;
  height: 18px;
  background: rgba(255,255,255,0.04);
  border: 1.5px solid rgba(255,255,255,0.18);
  border-radius: 5px;
  transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
}
.enc-cb:hover::before { border-color: color-mix(in srgb, var(--accent) 60%, transparent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
.enc-cb:active { transform: scale(0.92); }

.enc-cb-tick { position: relative; z-index: 1; }

.enc-cb--checked::before {
  background: var(--accent, var(--accent));
  border-color: var(--accent, var(--accent));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent);
}
.enc-cb--checked:hover::before { background: #6a4aee; border-color: #6a4aee; }

.enc-cb--disabled { opacity: 0.35; cursor: not-allowed; }
.enc-cb--disabled:hover::before { border-color: rgba(255,255,255,0.18); background: rgba(255,255,255,0.04); }
</style>
