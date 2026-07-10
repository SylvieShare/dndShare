<template>
  <SvgIcon v-if="type && type.svg" class="oti" :svg="type.svg" :color="type.color" />
  <span v-else class="oti-placeholder" aria-hidden="true"></span>
</template>

<script setup>
import SvgIcon from '@/shared/ui/SvgIcon'

defineProps({ type: { type: Object, default: null } })
</script>

<style scoped>
.oti {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
}

.oti-placeholder {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--border);
}
</style>
