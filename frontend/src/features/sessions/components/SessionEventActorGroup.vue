<template>
  <TimelineGroup class="event-actor-group" rail-width="minmax(170px, 24%)" compact-rail-width="96px" :gap="20" :compact-gap="12" :padding-block="20" sticky>
    <template #identity>
      <header class="event-actor-head">
        <SessionEventActorAvatar :event="group.actorEvent" :label="group.label" />
        <div class="event-actor-meta">
          <strong class="event-actor-name"><NpcMarker v-if="group.kind === 'creature' && group.actorEvent.data?.npcActor?.letter" :letter="group.actorEvent.data.npcActor.letter" :color="group.actorEvent.data.npcActor.color" />{{ group.label || (group.kind === 'dm' ? 'Мастер' : 'Системное событие') }}</strong>
          <span v-if="group.kind !== 'creature'">{{ group.authorIsSessionOwner ? 'я' : group.authorName }}</span>
        </div>
      </header>
    </template>
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
  </TimelineGroup>
  <ItemViewModal v-if="view" :item-id="Number(view.itemId)" :item="items[view.itemId] || null" :item-type-id="items[view.itemId]?.typeId || null" @close="view = null" />
</template>
<script setup>
import NpcMarker from './NpcMarker.vue'
import { ref } from 'vue'
import { TimelineGroup } from '@sylvieshare/share-ui'
import SessionEventActorAvatar from './SessionEventActorAvatar.vue'
import SessionEventEntityLabel from './SessionEventEntityLabel.vue'
import SessionEventRow from './SessionEventRow.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
const props = defineProps({ group: Object, items: Object, newEventIds: { type: Set, default: () => new Set() } })
const view = ref(null)
const entityName = entry => entry.entity?.name || props.items[entry.entity?.itemId]?.name || (entry.entity?.itemId ? `Запись #${entry.entity.itemId}` : '')
</script>
<style scoped>
.event-actor-head { display: flex; align-items: flex-start; gap: 12px; min-width: 0; overflow-wrap: anywhere; white-space: normal; }
.event-actor-meta { display: grid; gap: 4px; min-width: 0; }
.event-actor-meta strong { font-family: var(--font-display); font-size: 18px; color: var(--text-1); }
.event-actor-name { display: flex; align-items: baseline; gap: 6px; }
.event-actor-meta > span { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: var(--text-muted); font-size: 12px; }
.event-actor-entities { display: grid; align-content: start; gap: 20px; min-width: 0; }
.event-entity { min-width: 0; }
.event-entity-head { display: flex; gap: 12px; align-items: center; color: var(--text-1); font-size: 14px; overflow-wrap: anywhere; }
.event-entity-actions { display: grid; gap: 12px; min-width: 0; }
.event-entity-actions--nested { margin: 10px 0 0 48px; }
@media (max-width: 600px) {
  .event-actor-head { flex-direction: column; gap: 8px; }
  .event-actor-meta strong { font-size: 14px; }
  .event-entity-actions--nested { margin-left: 12px; }
}
</style>
