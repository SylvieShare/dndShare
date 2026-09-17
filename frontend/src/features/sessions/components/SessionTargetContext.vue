<template>
  <div class="target-context">
    <div class="target-context-source">
      <SessionEventIcon v-if="entity" :event="event" :item="item" />
      <SessionEventActorAvatar v-else :event="event" :label="name" />
      <div class="target-context-text"><strong><NpcMarker v-if="!entity && event.data?.npcActor?.letter" :letter="event.data.npcActor.letter" :color="event.data.npcActor.color" />{{ name }}</strong><span>{{ action }}</span></div>
    </div>
    <DiceRollResult v-if="event.data?.result" :result="event.data.result" :color="event.data.color" :size="28" />
    <span v-else-if="event.data?.savingThrow" class="target-context-save">{{ SAVE_ABILITIES[event.data.savingThrow.ability - 1] }} · Сл {{ event.data.savingThrow.dc }}</span>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import SessionEventActorAvatar from './SessionEventActorAvatar.vue'
import NpcMarker from './NpcMarker.vue'
import { useItemReferenceMap } from '@/features/items/composables/useItemReferenceMap'
import DiceRollResult from '@/shared/ui/DiceRollResult.vue'
import SessionEventIcon from './SessionEventIcon.vue'
import { sessionEventEntity, sessionEventAction } from '../lib/sessionEventEntity'
import { SAVE_ABILITIES } from '../lib/sessionSaveRoll'
const props = defineProps({ event: { type: Object, required: true } })
const entity = computed(() => sessionEventEntity(props.event))
const { itemById } = useItemReferenceMap(computed(() => entity.value?.itemId ? [entity.value.itemId] : []))
const item = computed(() => itemById(entity.value?.itemId))
const name = computed(() => entity.value?.name || item.value?.name || props.event.data?.npcActor?.name || props.event.actorName || 'Бросок')
const action = computed(() => sessionEventAction(props.event, name.value))
</script>
<style scoped>
.target-context { display: grid; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
.target-context-source { display: flex; align-items: center; gap: 10px; }
.target-context-text { display: grid; gap: 3px; min-width: 0; overflow-wrap: anywhere; }
.target-context-source strong { display: flex; align-items: baseline; gap: 6px; color: var(--text-1); font-size: 16px; }
.target-context-text > span, .target-context-save { color: var(--text-2); font-size: 13px; }
</style>
