<template>
  <article :data-event-id="event.id" class="event-row" :class="{ 'event-row--arriving': arriving, 'event-row--standalone': !grouped, 'event-row--with-entity': !!$slots.entity }">
    <SessionEventIcon v-if="!grouped" :event="event" />
    <div class="event-content">
      <div class="event-heading">
        <slot name="entity" />
        <span>{{ sessionEventAction(event, entityName) }}<template v-if="transition"> ({{ transition }})</template></span>
        <time :datetime="event.createdAt" :title="fullTime">{{ time }}</time>
      </div>
      <div v-if="hasBody" class="event-body">
        <DiceRollResult v-if="event.data?.result" :result="event.data.result" :size="32" />
        <div v-for="(adjustment, i) in event.data?.result?.adjustments || []" :key="i" class="event-adjustment">
          {{ adjustment.label }}: {{ adjustment.original }} → {{ adjustment.value }}
        </div>
        <div v-if="event.type === 'item_transfer'" class="event-transfer">
          <ArrowRight :size="17" aria-label="Кому" />
          <TransferPerson :name="event.data?.recipientName" :image-url="event.recipientImageUrl" />
          <span v-if="event.data?.count > 1">×{{ event.data.count }}</span>
          <TransferStatus :purpose="event.data?.purpose" :status="event.data?.status" />
          <SessionTransferApproval :event="event" />
          <ApplicationSummary v-if="event.data?.purpose === 'use'" :data="event.data?.status === 'accepted' ? event.data.applicationResult || {} : event.data.application || {}" :result="event.data?.status === 'accepted'" />
        </div>
        <div v-else-if="details" class="event-details">{{ details }}</div>
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
</template>
<script setup>
import ApplicationSummary from '@/features/character-editor/components/ApplicationSummary.vue'
import { computed } from 'vue'
import { ArrowRight } from '@lucide/vue'
import TransferPerson from '@/features/item-transfers/components/TransferPerson.vue'
import TransferStatus from '@/features/item-transfers/components/TransferStatus.vue'
import DiceRollResult from '@/shared/ui/DiceRollResult.vue'
import SpellSlotSphere from '@/features/items/components/SpellSlotSphere.vue'
import SessionEventIcon from './SessionEventIcon.vue'
import SessionTransferApproval from './SessionTransferApproval.vue'
import { sessionEventAction, sessionEventDetails, sessionEventTransition } from '../lib/sessionEventEntity'
const props = defineProps({ event: Object, entityName: String, grouped: Boolean, arriving: Boolean })
const date = computed(() => new Date(props.event.createdAt))
const fullTime = computed(() => Number.isNaN(date.value.getTime()) ? '' : date.value.toLocaleString('ru-RU'))
const time = computed(() => Number.isNaN(date.value.getTime()) ? '' : date.value.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
const transition = computed(() => sessionEventTransition(props.event))
const hasBody = computed(() => props.event.data?.result || details.value || props.event.data?.resourceChanges?.length)
const details = computed(() => sessionEventDetails(props.event))
</script>
<style scoped>
.event-row { min-width: 0; }
.event-row--standalone { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 12px; }
.event-content { display: grid; gap: 6px; min-width: 0; }
.event-body { display: grid; gap: 6px; min-width: 0; }
.event-row--with-entity .event-body { margin-left: 48px; }
.event-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; color: var(--text-2); font-size: 12px; line-height: 1.4; overflow-wrap: anywhere; }
.event-heading time { flex: none; margin-left: auto; color: var(--text-muted); font-size: 10px; font-variant-numeric: tabular-nums; }
.event-details { white-space: pre-wrap; }
.event-details, .event-adjustment { color: var(--text-muted); font-size: 11px; overflow-wrap: anywhere; }
.event-adjustment { color: var(--success); }
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
