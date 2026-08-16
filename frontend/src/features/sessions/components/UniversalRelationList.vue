<template>
  <div v-if="groups.length" class="entity-relation-list">
    <section v-for="group in groups" :key="group.key">
      <h3>{{ group.label }}<span>{{ group.items.length }}</span></h3>
      <button v-for="entry in group.items" :key="entry.item.key" type="button" @click="$emit('open', entry.item)">
        <img v-if="entry.item.image" :src="entry.item.image" alt="" />
        <span v-else class="entity-relation-avatar" :style="{ '--relation-color': entry.item.color || group.color }">{{ entry.item.title.slice(0, 1) }}</span>
        <span><strong>{{ entry.item.title }}</strong><small v-if="entry.relation.note">{{ entry.relation.note }}</small><small v-else>{{ entry.item.subtitle }}</small></span>
      </button>
    </section>
  </div>
  <p v-else class="session-world-muted">Связей пока нет.</p>
</template>
<script setup>
import { computed } from 'vue'
import { groupResolvedRelations } from '@/features/sessions/lib/sessionEntityRelations'
const props = defineProps({ relations: { type: Array, default: () => [] }, items: { type: Array, default: () => [] } })
defineEmits(['open'])
const groups = computed(() => groupResolvedRelations(props.relations, props.items))
</script>
<style scoped>
.entity-relation-list { display: flex; flex-direction: column; gap: 12px; }.entity-relation-list section { width: 100%; max-width: 520px; display: flex; flex-direction: column; gap: 5px; }.entity-relation-list h3 { display: flex; justify-content: space-between; margin: 0; color: var(--text-muted); font-size: 9px; text-transform: uppercase; letter-spacing: .08em; }.entity-relation-list button { display: grid; grid-template-columns: 48px minmax(0,1fr); align-items: center; gap: 10px; padding: 7px; border: 1px solid var(--border); border-radius: 10px; background: color-mix(in srgb,var(--surface-raised) 78%,transparent); color: var(--text-2); cursor: pointer; text-align: left; }.entity-relation-list button:hover { border-color: var(--accent); }.entity-relation-list img,.entity-relation-avatar { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 8px; object-fit: cover; }.entity-relation-avatar { background: color-mix(in srgb,var(--relation-color) 18%,var(--surface)); color: var(--relation-color); font-size: 16px; font-weight: 800; }.entity-relation-list button > span:last-child { min-width: 0; display: flex; flex-direction: column; gap: 2px; }.entity-relation-list strong,.entity-relation-list small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.entity-relation-list strong { color: var(--text-1); font-size: 12px; }.entity-relation-list small { color: var(--text-muted); font-size: 10px; }
</style>
