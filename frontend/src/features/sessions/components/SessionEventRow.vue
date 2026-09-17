<template>
  <article :data-event-id="event.id" class="event-row" :class="{ 'event-row--arriving': arriving, 'event-row--standalone': !grouped, 'event-row--with-entity': !!$slots.entity }">
    <SessionEventIcon v-if="!grouped" :event="event" />
    <div class="event-content">
      <div class="event-heading">
        <slot name="entity" />
        <span v-if="action || transition" class="event-action"><span class="event-action-dot" aria-hidden="true">•</span><span>{{ action }}<template v-if="transition"> ({{ transition }})</template></span></span>
        <time :datetime="event.createdAt" :title="fullTime">{{ time }}</time>
      </div>
      <div v-if="hasBody" class="event-body">
        <div v-if="event.data?.result" class="event-roll">
          <DiceRollResult :result="event.data.result" :color="event.data.color" :size="32" />
          <SessionAttackTargets v-if="event.data?.attackRoll" :event="event" :is-dm="isDm" />
          <ActionButton v-if="isDm && event.data?.damageRoll" size="sm" variant="dashed" @click="applying = true">Применить к целям</ActionButton>
        </div>
        <div v-for="(adjustment, i) in event.data?.result?.adjustments || []" :key="i" class="event-adjustment">
          {{ adjustment.label }}: {{ adjustment.original }} → {{ adjustment.value }}
        </div>
        <SessionSavingThrow v-if="event.data?.savingThrow" :event="event" />
        <DamageImpact v-for="impact in standaloneImpacts" :key="impact.key" :impact="impact" />
        <div v-if="event.type === 'item_transfer'" class="event-transfer">
          <ArrowRight :size="17" aria-label="Кому" />
          <span v-if="event.data?.resolvedTarget?.kind === 'npc'" class="event-target-npc">
            <NpcMarker :letter="event.data.resolvedTarget.letter" :color="event.data.resolvedTarget.color" />
            <strong>{{ event.data.resolvedTarget.name }}</strong>
          </span>
          <TransferPerson v-else :name="event.data?.resolvedTarget?.name || event.data?.recipientName" :image-url="event.recipientImageUrl" />
          <span v-if="event.data?.count > 1">×{{ event.data.count }}</span>
          <TransferStatus :purpose="event.data?.purpose" :status="event.data?.status" />
          <SessionTransferApproval :event="event" />
        </div>
        <div v-else-if="details" class="event-details">{{ details }}</div>
        <ApplicationSummary v-if="event.data?.applicationResult" :data="event.data.applicationResult" result />
        <ApplicationSummary v-else-if="event.data?.purpose === 'use' && event.data?.status === 'pending'" :data="event.data.application || {}" />
        <div v-if="event.data?.resourceChanges?.length" class="event-resources">
          <span v-for="(change, i) in event.data.resourceChanges" :key="i" class="event-resource" :class="change.delta < 0 ? 'event-resource--spent' : 'event-resource--added'">
            <b>{{ change.delta < 0 ? '−' : '+' }}</b>
            <SpellSlotSphere :level="change.level || 1" :color="change.color" :size="24" :interactive="false" />
            <b v-if="Math.abs(change.delta) > 1">×{{ Math.abs(change.delta) }}</b>
            <span class="event-resource-label" :class="{ 'event-resource-label--level': change.level }">{{ change.level ? `${change.level} круг` : change.name }}</span>
          </span>
        </div>
      </div>
    </div>
  </article>
  <SessionImpactModal v-if="applying" :event="event" @close="applying = false" />
</template>
<script setup>
import { ActionButton } from '@sylvieshare/share-ui'
import { useAccountStore } from '@/stores/account'
import ApplicationSummary from '@/features/character-editor/components/ApplicationSummary.vue'
import NpcMarker from './NpcMarker.vue'
import { computed, defineAsyncComponent, ref } from 'vue'
import { sessionEventTime } from '../lib/sessionEventTime'
import { ArrowRight } from '@lucide/vue'
import TransferPerson from '@/features/item-transfers/components/TransferPerson.vue'
import TransferStatus from '@/features/item-transfers/components/TransferStatus.vue'
import DiceRollResult from '@/shared/ui/DiceRollResult.vue'
import SpellSlotSphere from '@/features/items/components/SpellSlotSphere.vue'
import SessionEventIcon from './SessionEventIcon.vue'
import SessionTransferApproval from './SessionTransferApproval.vue'
import { sessionEventAction, sessionEventDetails, sessionEventTransition } from '../lib/sessionEventEntity'
const SessionSavingThrow = defineAsyncComponent(() => import('./SessionSavingThrow.vue'))
const SessionAttackTargets = defineAsyncComponent(() => import('./SessionAttackTargets.vue'))
const DamageImpact = defineAsyncComponent(() => import('./DamageImpact.vue'))
const SessionImpactModal = defineAsyncComponent(() => import('./SessionImpactModal.vue'))
const props = defineProps({ event: Object, entityName: String, grouped: Boolean, arriving: Boolean })
const account = useAccountStore(), applying = ref(false)
const isDm = computed(() => Number(account.user?.id) === Number(props.event.sessionOwnerUserId))
const standaloneImpacts = computed(() => (props.event.data?.impacts || []).filter(impact => !props.event.data?.savingThrow?.results?.some(row => row.key === impact.key)))
const action = computed(() => sessionEventAction(props.event, props.entityName))
const date = computed(() => new Date(props.event.createdAt))
const fullTime = computed(() => Number.isNaN(date.value.getTime()) ? '' : date.value.toLocaleString('ru-RU'))
const time = computed(() => sessionEventTime(props.event.createdAt))
const transition = computed(() => sessionEventTransition(props.event))
const hasBody = computed(() => props.event.data?.impacts?.length || props.event.data?.savingThrow || props.event.type === 'item_transfer' || props.event.data?.applicationResult || props.event.data?.result || details.value || props.event.data?.resourceChanges?.length)
const details = computed(() => sessionEventDetails(props.event))
</script>
<style scoped>
.event-roll { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }.event-roll > button, .event-roll > .attack-targets { margin-left: auto; }
.event-row { min-width: 0; }
.event-row--standalone { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 12px; }
.event-content { display: grid; gap: 6px; min-width: 0; }
.event-body { display: grid; gap: 6px; min-width: 0; }
.event-row--with-entity .event-body { margin-left: 48px; }
.event-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; color: var(--text-2); font-size: 12px; line-height: 1.4; overflow-wrap: anywhere; }
.event-action { display: inline-flex; align-items: baseline; gap: 8px; min-width: 0; color: var(--text-1); font-size: 14px; font-weight: 650; }
.event-action-dot { flex: none; color: var(--accent); font-weight: 800; }
.event-heading time { flex: none; margin-left: auto; color: var(--text-muted); font-size: 10px; font-variant-numeric: tabular-nums; }
.event-details { white-space: pre-wrap; }
.event-details, .event-adjustment { color: var(--text-muted); font-size: 11px; overflow-wrap: anywhere; }
.event-adjustment { color: var(--success); }
.event-target-npc { display: inline-flex; align-items: center; gap: 6px; color: var(--text-1); }
.event-transfer { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; color: var(--text-muted); font-size: 12px; }
.event-resources { display: flex; flex-wrap: wrap; gap: 6px; }
.event-resource { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 4px 8px; border: 1px solid currentColor; border-radius: var(--r-sm); font-size: 11px; }
.event-resource--spent { color: var(--danger); }
.event-resource--added { color: var(--success); }
.event-resource-label { border-left: 1px solid var(--border-strong); margin-left: 2px; padding-left: 8px; color: var(--text-muted); overflow-wrap: anywhere; }
.event-resource-label--level { color: var(--text-1); font-size: 13px; font-weight: 650; }
.event-row--arriving { animation: chronicle-entry-in .42s cubic-bezier(.22, 1, .36, 1) both; }
@keyframes chronicle-entry-in {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) { .event-row--arriving { animation: none; } }
</style>
