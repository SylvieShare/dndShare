<template>
  <ItemIcon v-if="item.iconImageUrl || item.svg || item.iconSvgId" :item="item" :size="size" />
  <img v-else-if="item.coverImageUrl" :src="item.coverImageUrl" :width="size" :height="size"
    class="thumbnail" alt="" loading="lazy" />
  <component v-else :is="fallback || Package" :size="size" aria-hidden="true" />
</template>
<script setup>
import { Package } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
defineProps({ item: { type: Object, required: true }, size: Number, fallback: [Object, Function] })
</script>
<style scoped>
.thumbnail { flex: none; object-fit: cover; border-radius: var(--r-sm); }
</style>
