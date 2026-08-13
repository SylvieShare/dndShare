<template>
  <span
    v-if="svg || simplified"
    class="inventory-item-icon"
    :class="{ 'inventory-item-icon--simplified': simplified }"
    aria-hidden="true"
  >
    <SvgIcon v-if="svg" class="inventory-item-icon__svg" :svg="svg" />
    <svg v-else viewBox="0 0 24 24" fill="none" focusable="false">
      <path d="M6 4h9l3 3v13H6V4Z" />
      <path d="M15 4v4h3M9 12h6M9 16h4" />
      <path d="M4 7v13h10" stroke-dasharray="2 2" />
    </svg>
  </span>
</template>

<script setup>
import SvgIcon from '@/shared/ui/SvgIcon.vue'

defineProps({
  svg: { type: String, default: '' },
  simplified: { type: Boolean, default: false },
})
</script>

<style scoped>
.inventory-item-icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 30px;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border));
  border-radius: 9px;
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  color: color-mix(in srgb, var(--accent) 78%, var(--text-1));
}

.inventory-item-icon__svg {
  width: 20px;
  height: 20px;
}

.inventory-item-icon--simplified {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--text-muted) 42%, var(--border));
  background: color-mix(in srgb, var(--text-muted) 7%, transparent);
  color: var(--text-muted);
}

.inventory-item-icon--simplified svg {
  width: 19px;
  height: 19px;
  display: block;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
