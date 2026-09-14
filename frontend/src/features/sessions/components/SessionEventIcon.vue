<template>
  <span class="event-icon" aria-hidden="true">
    <ItemIcon v-if="art?.iconImageUrl || art?.svg" :item="art" :size="36" />
    <SpellSlotSphere v-else-if="!item && !event.data?.source?.itemId && (event.type === 'spell_slot_changed' || event.data?.resourceChanges?.length)" :size="30" :level="event.data?.slotLevel || 1" :color="event.data?.resourceChanges?.[0]?.color" :interactive="false" />
    <component v-else :is="icon" :size="26" :stroke-width="1.5" />
  </span>
</template>
<script setup>
import { computed, watch } from 'vue'
import { useSuggestStore } from '@/stores/suggest'
import { MessageCircle, Hand, BookOpen, Dices, Moon, Package, Shield, Sparkles, Swords, Flag, CircleCheck } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import SpellSlotSphere from '@/features/items/components/SpellSlotSphere.vue'
const props = defineProps({ event: Object, item: Object })
const suggests = useSuggestStore()
const ability = computed(() => props.event.data?.ability)
watch(() => ability.value?.typeId, id => { if (id) suggests.ensure(id).catch(() => {}) }, { immediate: true })
const art = computed(() => props.item || (ability.value ? suggests.items(ability.value.typeId)?.find(row => String(row.id) === String(ability.value.id)) : null))
const icon = computed(() => {
  if (props.event.data?.ability) return Shield
  if (props.item || props.event.data?.source?.itemId) return Package
  return { chat_message: MessageCircle, rps_challenge: Hand, dice_roll: Dices, spell_used: Sparkles, rest_completed: Moon, item_spent: Package, item_added: Package, item_transfer: Package,
    entry_added: BookOpen, feature_state: Sparkles, status_effect: Sparkles, chapter_started: Flag,
    encounter_started: Swords, encounter_finished: CircleCheck }[props.event.type] || Sparkles
})
</script>
<style scoped>
.event-icon { width: 36px; height: 36px; display: inline-flex; flex: 0 0 36px; align-items: center; justify-content: center; color: var(--accent-soft); }
</style>
