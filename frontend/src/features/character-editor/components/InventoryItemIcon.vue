<template>
  <span class="inventory-item-icon" aria-hidden="true">
    <img v-if="imageUrl || typeImageUrl" class="inventory-item-icon__image" :src="imageUrl || typeImageUrl" alt="" />
    <SvgIcon v-else-if="svg" class="inventory-item-icon__svg" :svg="svg" />
  </span>
</template>

<script setup>
import SvgIcon from '@/shared/ui/SvgIcon.vue'

defineProps({
  svg: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  typeImageUrl: { type: String, default: '' },
})
</script>

<style scoped>
.inventory-item-icon {
  width: 64px;
  height: 64px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 64px;
  color: var(--text-muted);
}

.inventory-item-icon__svg {
  width: 64px;
  height: 64px;
}
.inventory-item-icon__image { width: 64px; height: 64px; display: block; object-fit: contain; }
</style>
