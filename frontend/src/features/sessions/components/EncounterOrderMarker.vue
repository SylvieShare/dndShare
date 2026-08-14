<template>
  <div class="enc-row-order" :class="{ 'enc-row-order--current': current }" aria-hidden="true">
    <span>{{ label }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  order: { type: Number, required: true },
  current: { type: Boolean, default: false },
})

const label = computed(() => String(props.order).padStart(2, '0'))
</script>

<style scoped>
.enc-row-order {
  position: relative;
  display: flex;
  width: 36px;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  color: color-mix(in srgb, var(--section-color) 82%, var(--text-1));
}

.enc-row-order::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: linear-gradient(
    180deg,
    transparent,
    color-mix(in srgb, var(--section-color) 34%, transparent) 22%,
    color-mix(in srgb, var(--section-color) 34%, transparent) 78%,
    transparent
  );
}

.enc-row-order span {
  position: relative;
  z-index: 1;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--section-color) 46%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--section-color) 12%, var(--surface));
  box-shadow: 0 0 14px color-mix(in srgb, var(--section-color) 12%, transparent);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.05em;
  transition: color 0.15s, background 0.15s, border-color 0.15s, transform 0.15s;
}

.enc-row-order--current span {
  border-color: color-mix(in srgb, var(--accent) 72%, transparent);
  background: var(--accent);
  color: var(--text-on-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
  transform: scale(1.06);
}

@media (prefers-reduced-motion: reduce) {
  .enc-row-order span { transition: none; }
}
</style>
