<template>
  <section class="event-actor-group">
    <header class="event-actor-head">
      <SessionEventActorAvatar :event="group.actorEvent" :label="group.label" />
      <div class="event-actor-meta">
        <strong>{{ group.label || (group.kind === 'dm' ? 'Мастер' : 'Системное событие') }}</strong>
        <span>{{ group.authorIsSessionOwner ? 'я' : group.authorName }}</span>
      </div>
    </header>
    <div class="event-actor-entities">
      <section v-for="entry in group.entities" :key="entry.key" class="event-entity">
        <header v-if="entry.entity" class="event-entity-head">
          <SessionEventIcon :event="entry.events[0]" :item="items[entry.entity.itemId]" />
          <button v-if="entry.entity.itemId" type="button" class="event-item-link" @click="view = entry.entity">
            {{ entityName(entry) }}
          </button>
          <strong v-else>{{ entityName(entry) }}</strong>
        </header>
        <div class="event-entity-actions" :class="{ 'event-entity-actions--nested': entry.entity }">
          <SessionEventRow v-for="event in entry.events" :key="event.id" :event="event" :entity-name="entityName(entry)" :grouped="!!entry.entity" />
        </div>
      </section>
    </div>
    <ItemViewModal v-if="view" :item-id="Number(view.itemId)" :item="items[view.itemId] || null" :item-type-id="items[view.itemId]?.typeId || null" @close="view = null" />
  </section>
</template>
<script setup>
import { ref } from 'vue'
import SessionEventActorAvatar from './SessionEventActorAvatar.vue'
import SessionEventIcon from './SessionEventIcon.vue'
import SessionEventRow from './SessionEventRow.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
const props = defineProps({ group: Object, items: Object })
const view = ref(null)
const entityName = entry => entry.entity?.name || props.items[entry.entity?.itemId]?.name || (entry.entity?.itemId ? `Запись #${entry.entity.itemId}` : '')
</script>
<style scoped>
.event-actor-group { display: grid; grid-template-columns: minmax(170px, 24%) minmax(0, 1fr); gap: 20px; min-width: 0; padding-block: 20px; }
.event-actor-group + .event-actor-group { border-top: 1px solid var(--border); }
.event-actor-head { --event-connector-color: color-mix(in srgb, var(--accent) 38%, var(--border)); position: relative; display: flex; align-items: flex-start; gap: 12px; min-width: 0; padding-right: 20px; border-right: 2px solid var(--event-connector-color); overflow-wrap: anywhere; white-space: normal; }
.event-actor-head::after { content: ''; position: absolute; top: 0; right: -5px; width: 8px; height: 8px; box-sizing: border-box; border-top: 2px solid var(--event-connector-color); border-left: 2px solid var(--event-connector-color); transform: rotate(45deg); }
.event-actor-meta { display: grid; gap: 4px; min-width: 0; }
.event-actor-meta strong { font-family: var(--font-display); font-size: 18px; color: var(--text-1); }
.event-actor-meta > span { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: var(--text-muted); font-size: 12px; }
.event-actor-entities { display: grid; align-content: start; gap: 20px; min-width: 0; }
.event-entity { min-width: 0; }
.event-entity-head { display: flex; gap: 12px; align-items: center; color: var(--text-1); font-size: 14px; overflow-wrap: anywhere; }
.event-item-link { padding: 0; border: 0; background: none; color: var(--text-1); font: inherit; font-weight: 650; text-align: left; text-decoration: underline; text-decoration-color: var(--border); text-underline-offset: 4px; cursor: pointer; overflow-wrap: anywhere; min-width: 0; }
.event-item-link:hover { color: var(--accent-soft); text-decoration-color: currentColor; }
.event-item-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
.event-entity-actions { display: grid; gap: 12px; min-width: 0; }
.event-entity-actions--nested { margin: 10px 0 0 48px; }
@media (max-width: 600px) {
  .event-actor-group { grid-template-columns: 96px minmax(0, 1fr); gap: 12px; }
  .event-actor-head { flex-direction: column; gap: 8px; padding-right: 12px; }
  .event-actor-meta strong { font-size: 14px; }
  .event-entity-actions--nested { margin-left: 12px; }
}
</style>
