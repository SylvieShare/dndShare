<template>
  <section class="event-actor-group">
    <div class="event-actor-rail">
      <header class="event-actor-head">
        <SessionEventActorAvatar :event="group.actorEvent" :label="group.label" />
        <div class="event-actor-meta">
          <strong>{{ group.label || (group.kind === 'dm' ? 'Мастер' : 'Системное событие') }}</strong>
          <span>{{ group.authorIsSessionOwner ? 'я' : group.authorName }}</span>
        </div>
      </header>
    </div>
    <div class="event-actor-entities">
      <section v-for="entry in group.entities" :key="entry.key" class="event-entity">
        <header v-if="entry.entity && entry.events.length > 1" class="event-entity-head">
          <SessionEventEntityLabel :entry="entry" :item="items[entry.entity.itemId]" :name="entityName(entry)" @view="view = $event" />
        </header>
        <div class="event-entity-actions" :class="{ 'event-entity-actions--nested': entry.entity && entry.events.length > 1 }">
          <SessionEventRow v-for="event in entry.events" :key="event.id" :event="event" :entity-name="entityName(entry)"
            :grouped="!!entry.entity" :arriving="newEventIds.has(event.id)">
            <template v-if="entry.entity && entry.events.length === 1" #entity>
              <SessionEventEntityLabel :entry="entry" :item="items[entry.entity.itemId]" :name="entityName(entry)" @view="view = $event" />
            </template>
          </SessionEventRow>
        </div>
      </section>
    </div>
    <ItemViewModal v-if="view" :item-id="Number(view.itemId)" :item="items[view.itemId] || null" :item-type-id="items[view.itemId]?.typeId || null" @close="view = null" />
  </section>
</template>
<script setup>
import { ref } from 'vue'
import SessionEventActorAvatar from './SessionEventActorAvatar.vue'
import SessionEventEntityLabel from './SessionEventEntityLabel.vue'
import SessionEventRow from './SessionEventRow.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
const props = defineProps({ group: Object, items: Object, newEventIds: { type: Set, default: () => new Set() } })
const view = ref(null)
const entityName = entry => entry.entity?.name || props.items[entry.entity?.itemId]?.name || (entry.entity?.itemId ? `Запись #${entry.entity.itemId}` : '')
</script>
<style scoped>
.event-actor-group { display: grid; grid-template-columns: minmax(170px, 24%) minmax(0, 1fr); gap: 20px; min-width: 0; padding-block: 20px; }
.event-actor-group + .event-actor-group { border-top: 1px solid var(--border); }
.event-actor-rail { --event-connector-color: color-mix(in srgb, var(--accent) 38%, var(--border)); position: relative; min-width: 0; border-right: 2px solid var(--event-connector-color); }
.event-actor-rail::after { content: ''; position: absolute; top: 0; right: -5px; width: 8px; height: 8px; box-sizing: border-box; border-top: 2px solid var(--event-connector-color); border-left: 2px solid var(--event-connector-color); transform: rotate(45deg); }
.event-actor-head { position: sticky; top: 12px; display: flex; align-items: flex-start; gap: 12px; min-width: 0; padding-right: 20px; overflow-wrap: anywhere; white-space: normal; }
.event-actor-meta { display: grid; gap: 4px; min-width: 0; }
.event-actor-meta strong { font-family: var(--font-display); font-size: 18px; color: var(--text-1); }
.event-actor-meta > span { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: var(--text-muted); font-size: 12px; }
.event-actor-entities { display: grid; align-content: start; gap: 20px; min-width: 0; }
.event-entity { min-width: 0; }
.event-entity-head { display: flex; gap: 12px; align-items: center; color: var(--text-1); font-size: 14px; overflow-wrap: anywhere; }
.event-entity-actions { display: grid; gap: 12px; min-width: 0; }
.event-entity-actions--nested { margin: 10px 0 0 48px; }
@media (max-width: 600px) {
  .event-actor-group { grid-template-columns: 96px minmax(0, 1fr); gap: 12px; }
  .event-actor-head { flex-direction: column; gap: 8px; padding-right: 12px; }
  .event-actor-meta strong { font-size: 14px; }
  .event-entity-actions--nested { margin-left: 12px; }
}
</style>
