<template>
  <span
    v-if="iconImageUrl || iconSvg || placeholder"
    class="item-icon"
    :class="{ 'item-icon--type': usesTypeIcon, 'item-icon--placeholder': !iconImageUrl && !iconSvg }"
    :style="iconStyle"
    aria-hidden="true"
  >
    <img v-if="iconImageUrl" class="item-icon__image" :src="iconImageUrl" alt="" />
    <SvgIcon v-else-if="iconSvg" class="item-icon__svg" :svg="iconSvg" :color="iconColor" />
  </span>
</template>

<script setup>
import { computed } from 'vue'
import SvgIcon from '@/shared/ui/SvgIcon.vue'

const props = defineProps({
  item: { type: Object, default: null },
  type: { type: Object, default: null },
  size: { type: [Number, String], default: 22 },
  fallbackToType: { type: Boolean, default: true },
  placeholder: { type: Boolean, default: false },
})

const iconImageUrl = computed(() => props.item?.iconImageUrl || '')
const usesTypeIcon = computed(() => !iconImageUrl.value && !props.item?.svg && props.fallbackToType && !!props.type?.svg)
const iconSvg = computed(() => props.item?.svg || (usesTypeIcon.value ? props.type.svg : ''))
const iconColor = computed(() => usesTypeIcon.value ? props.type?.color : null)
const iconStyle = computed(() => {
  const size = typeof props.size === 'number' ? `${props.size}px` : props.size
  return { width: size, height: size }
})
</script>

<style scoped>
.item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-2);
}

.item-icon__svg { width: 100%; height: 100%; }
.item-icon__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.item-icon--type { opacity: 0.5; }

.item-icon--placeholder {
  display: inline-block;
  border-radius: 50%;
  background: var(--border);
}
</style>
