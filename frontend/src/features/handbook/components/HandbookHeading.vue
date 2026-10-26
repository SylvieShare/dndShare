<template>
  <div class="handbook-heading">
    <RouterLink v-if="collection" class="handbook-home-link" to="/handbook">Справочник</RouterLink>
    <span v-else>Справочник</span>
    <Transition name="collection-label">
      <span v-if="collection" :key="collection.id" class="handbook-heading-collection">
        <span class="handbook-heading-dot" aria-hidden="true">·</span>
        <ItemIcon v-if="collection.iconImageUrl" :type="collection" :size="22" class="handbook-heading-icon" />
        <BookOpen v-else :size="22" class="handbook-heading-icon" aria-hidden="true" />
        <span class="handbook-heading-name" :title="collection.name">{{ collection.name }}</span>
      </span>
    </Transition>
  </div>
</template>

<script setup>
import { BookOpen } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useItemTypesStore } from '@/stores/itemTypes'
import ItemIcon from '@/features/items/components/ItemIcon.vue'

const props = defineProps({ type: { type: Object, default: undefined } })
const route = useRoute()
const types = useItemTypesStore()
const collection = computed(() => props.type !== undefined ? props.type
  : types.allTypes.find(type => Number(type.id) === Number(route.query.type)) || null)
</script>

<style scoped>
.handbook-heading {
  display: flex; align-items: center; gap: var(--spacing-small); min-width: 0;
  font-family: var(--type-header-family); font-size: var(--type-header-size);
  font-weight: var(--type-header-weight); line-height: var(--type-header-line-height);
}
.handbook-home-link { position: relative; flex-shrink: 0; color: var(--text-1); text-decoration: none; transition: color var(--motion-feedback); }
.handbook-home-link::after { content: ''; position: absolute; inset: -12px 0; }
.handbook-home-link:hover { color: var(--accent-soft); }
.handbook-heading-collection { display: flex; align-items: center; gap: var(--spacing-small); min-width: 0; }
.handbook-heading-dot { color: var(--text-muted); }
.handbook-heading-icon { flex-shrink: 0; }
.handbook-heading-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.collection-label-enter-active, .collection-label-leave-active { transition: opacity var(--motion-enter), transform var(--motion-navigation); }
.collection-label-enter-from, .collection-label-leave-to { opacity: 0; transform: translateX(8px); }
.collection-label-leave-active { position: absolute; pointer-events: none; }
@media (prefers-reduced-motion: reduce) {
  .collection-label-enter-active, .collection-label-leave-active, .handbook-home-link { transition: none; }
  .collection-label-enter-from, .collection-label-leave-to { transform: none; }
}
</style>
