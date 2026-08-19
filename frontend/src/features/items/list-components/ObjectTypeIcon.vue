<template>
  <img v-if="type?.iconImageUrl" class="oti" :src="type.iconImageUrl" alt="" aria-hidden="true" />
  <span v-else class="oti-placeholder" aria-hidden="true"></span>
</template>

<script setup>
defineProps({ type: { type: Object, default: null } })
</script>

<style scoped>
.oti {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
  opacity: 0.72;
}

.oti-placeholder {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--border);
}
</style>
