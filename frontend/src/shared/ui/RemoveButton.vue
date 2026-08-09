<template>
  <button
    class="rm-btn"
    :class="`rm-btn--${variant}`"
    type="button"
    :aria-label="label"
    @click="$emit('click', $event)"
  >
    <span class="rm-cross" aria-hidden="true"></span>
  </button>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'inline' },
  label: { type: String, default: 'Удалить' },
})
defineEmits(['click'])
</script>

<style scoped>
.rm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: none;
  border: none;
  color: color-mix(in srgb, var(--text-muted) 65%, transparent);
  cursor: pointer;
  padding: 0;
  transition: color 0.12s, background 0.12s, border-color 0.12s;
}

.rm-btn:hover { color: var(--danger); }

.rm-btn--inline {
  width: 22px;
  height: 22px;
  border-radius: 5px;
}
.rm-btn--inline:hover { background: color-mix(in srgb, var(--danger) 12%, transparent); }

.rm-btn--boxed {
  width: 30px;
  height: 30px;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 8%, transparent);
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  border-radius: 6px;
}
.rm-btn--boxed:hover { border-color: color-mix(in srgb, var(--danger) 40%, transparent); }

.rm-cross { position: relative; width: 11px; height: 11px; }
.rm-cross::before,
.rm-cross::after {
  content: '';
  position: absolute;
  inset: 50% 0 auto 0;
  height: 1.5px;
  background: currentColor;
  border-radius: 1px;
}
.rm-cross::before { transform: rotate(45deg); }
.rm-cross::after { transform: rotate(-45deg); }
</style>
