<template>
  <div v-if="instances.length" class="npc-effects">
    <div v-for="effect in instances" :key="effect.uid" class="npc-effect">
      <ItemIcon v-if="itemById(effect.effect_id)" :item="itemById(effect.effect_id)" :size="24" />
      <span><strong>{{ itemById(effect.effect_id)?.name || 'Эффект' }}</strong><small>{{ statusDuration(effect.duration) }}<template v-if="effect.requires_concentration"> · концентрация источника</template></small></span>
      <RowActionMenu v-if="editable && itemById(effect.effect_id)?.data?.ongoing_damage" :title="`Действия: ${itemById(effect.effect_id).name}`">
        <template #trigger><ActionButton>Действия</ActionButton></template>
        <template #default><StatusMechanicsMenu :uid="effect.uid" :effect="itemById(effect.effect_id)" :context="context" /></template>
      </RowActionMenu>
      <RemoveButton v-if="editable" icon="trash" label="Убрать эффект" @click.stop="$emit('remove', effect.uid)" />
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { ActionButton, RemoveButton, RowActionMenu } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { useItemReferenceMap } from '@/features/items/composables/useItemReferenceMap'
import StatusMechanicsMenu from '@/features/character-editor/blocks/dnd/components/StatusMechanicsMenu.vue'
import { npcApplicationContext } from '../lib/npcApplicationContext'
import { statusDuration } from '@/shared/lib/statusDuration'
const props = defineProps({ combatant: Object, instances: { type: Array, default: () => [] }, editable: Boolean })
defineEmits(['remove'])
const { itemById, itemsById } = useItemReferenceMap(computed(() => [...props.instances.map(row => row.effect_id), props.combatant?.itemId].filter(Boolean)))
const context = computed(() => npcApplicationContext(props.combatant, itemById(props.combatant?.itemId), itemsById.value, props.editable))
</script>
<style scoped>
.npc-effects { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 5px; }
.npc-effect { display: flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: var(--r-sm); padding: 4px 7px; }
.npc-effect span { display: grid; gap: 2px; font-size: 12px; }
.npc-effect small { color: var(--text-muted); font-size: 10px; }
</style>
