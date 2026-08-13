<template>
  <span class="inventory-item-icon" aria-hidden="true">
    <SvgIcon v-if="svg" class="inventory-item-icon__svg" :svg="svg" />
  </span>
</template>

<script setup>
import SvgIcon from '@/shared/ui/SvgIcon.vue'

defineProps({
  svg: { type: String, default: '' },
})
</script>

<style scoped>
.inventory-item-icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 32px;
  color: var(--text-muted);
}

.inventory-item-icon__svg {
  width: 26px;
  height: 26px;
}
</style>
