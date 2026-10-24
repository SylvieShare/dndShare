<template>
  <SessionCreatureTile :name="name" :color="color" :current="current" :controls-visible="selectable" :has-statuses="hasStatuses">
    <template v-if="selectable" #controls><CompactCheckbox :size="20" :model-value="selected" :label="`Выбрать: ${name}`" @update:model-value="$emit('select')" /></template>
    <template #avatar><EncounterAvatar :combatant="combatant" /></template>
    <template #name-prefix><EncounterMarkerMenu v-if="isNpc" :combatant="combatant" :editable="editable" /></template>
    <template #name-suffix>
      <EncounterSideTag v-if="isNpc" :side="combatant.side" />
      <span v-if="combatant.initiative != null" class="combatant-initiative" :aria-label="`Инициатива: ${combatant.initiative}`"><img src="/static/initiative.svg" width="14" height="14" alt="" />{{ combatant.initiative }}</span>
      <span v-if="combatant.surprised && (!enc.encounter.active || enc.encounter.round === 0)" class="combatant-surprised" title="Застигнут врасплох">врасплох</span>
      <slot name="actions" />
    </template>
    <template #health><EncounterHpBar :combatant="combatant" :section="section" compact /></template>
    <template #stats>
      <ParticipantStats v-if="participant && isDnd" :participant="participant" />
      <div v-else class="combatant-indicators"><span class="enc-ac" :aria-label="`Класс доспеха: ${enc.displayAc(combatant) ?? '—'}`" title="Класс доспеха"><strong>{{ enc.displayAc(combatant) ?? '—' }}</strong><Shield :size="14" /></span><span v-if="combatant.note" class="combatant-note" :title="combatant.note">{{ combatant.note }}</span></div>
    </template>
    <template #statuses>
      <ParticipantStatuses v-if="participant && isDnd" :participant="participant" :editable="editable" />
      <EncounterStatuses v-else :combatant="combatant" :editable="editable" />
    </template>
    <template v-if="$slots.result" #result><slot name="result" /></template>
  </SessionCreatureTile>
</template>
<script setup>
import { computed, defineAsyncComponent, inject } from 'vue'
import { CompactCheckbox } from '@sylvieshare/share-ui'
import { Shield } from '@lucide/vue'
import { useTemplateStore } from '@/stores/template'
import { settingAccessors } from '@/features/character-editor/settings'
import SessionCreatureTile from './SessionCreatureTile.vue'
import EncounterAvatar from './EncounterAvatar.vue'
import EncounterMarkerMenu from './EncounterMarkerMenu.vue'
import EncounterSideTag from './EncounterSideTag.vue'
import EncounterHpBar from './EncounterHpBar.vue'
const ParticipantStats = defineAsyncComponent(() => import('./ParticipantStats.vue'))
const ParticipantStatuses = defineAsyncComponent(() => import('./ParticipantStatuses.vue'))
const EncounterStatuses = defineAsyncComponent(() => import('./EncounterStatuses.vue'))
const props = defineProps({ combatant: { type: Object, required: true }, section: { type: String, default: 'combat' }, current: Boolean, selectable: Boolean, selected: Boolean, placed: Boolean, editable: Boolean })
defineEmits(['select'])
const enc = inject('encounter', null) || inject('applicationEncounter', null)
const isNpc = computed(() => props.combatant.type === 'npc')
const participant = computed(() => !isNpc.value ? enc.findParticipant(props.combatant.charId) : null)
const templates = useTemplateStore()
const isDnd = computed(() => settingAccessors(templates.byId(participant.value?.templateId))?.system === 'dnd5e')
const name = computed(() => isNpc.value ? enc.npcName(props.combatant) : enc.playerDisplayName(props.combatant))
const color = computed(() => props.placed ? 'var(--accent)' : enc.tileColor(props.combatant))
const hasStatuses = computed(() => participant.value ? isDnd.value && !!participant.value.data?.values?.states?.length : !!(props.combatant.effectInstances?.length || enc.statesValue(props.combatant)?.length))
</script>
<style scoped>
.combatant-initiative { flex: none; display: inline-flex; align-items: center; gap: 3px; color: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.combatant-indicators { display: flex; align-items: center; justify-content: center; min-width: 0; gap: 10px; min-height: 18px; }
.enc-ac { display: inline-flex; align-items: center; gap: 4px; color: var(--text-1); font-size: 13px; }
.enc-ac svg { color: var(--info); }
.combatant-surprised { flex: none; color: var(--warning); font-size: 9px; }
.combatant-note { color: var(--text-muted); font-size: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
</style>
