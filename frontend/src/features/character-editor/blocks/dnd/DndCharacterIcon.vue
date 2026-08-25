<template>
  <div class="dci-icon" aria-hidden="true">
    <img v-if="imageUrl" :src="imageUrl" alt="" />
    <span v-else>{{ monogram }}</span>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const props = defineProps({
  values: { type: Object, default: () => ({}) },
})
const charCtx = inject('charCtx', {})

const imageUrl = computed(() => charCtx.iconImageUrl || props.values?.ava?.url || '')
const monogram = computed(() => String(props.values?.name || '?').trim().slice(0, 1).toUpperCase() || '?')
</script>

<style scoped>
.dci-icon {
  display: grid;
  width: 88px;
  height: 88px;
  place-items: center;
  align-self: center;
  flex: 0 0 88px;
  margin-left: 15px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--accent) 32%, var(--border));
  border-radius: 18px;
  background: color-mix(in srgb, var(--accent) 13%, var(--surface-raised));
  color: var(--accent-soft);
  font-size: 30px;
  font-weight: 800;
}
.dci-icon img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
