<template>
  <DetailSection label="Маршрут">
    <div class="global-route-settings">
      <FormField label="Название" vertical><FormTextInput :value="route.name" :maxlength="120" :disabled="disabled" aria-label="Название маршрута" @update:value="emit('change', { name: $event })" /></FormField>
      <FormField label="Цвет линии" vertical><ColorPresetPicker :model-value="route.color" :colors="ROUTE_COLORS" allow-custom aria-label="Цвет маршрута" @update:model-value="emit('change', { color: $event })" /></FormField>
      <DetailSection label="Игроки маршрута">
        <p v-if="!participants.length" class="map-hint">Участников пока нет.</p>
        <div v-for="player in participants" :key="player.charId" class="global-route-player">
          <img v-if="pvAvatar(player)" :src="pvAvatar(player)" alt="" />
          <UserRound v-else :size="24" />
          <span class="global-route-player-name">{{ pvName(player) || 'Игрок' }}</span>
          <CompactCheckbox :model-value="route.playerIds.includes(player.charId)" :label="pvName(player) || 'Игрок'" :disabled="disabled"
            @update:model-value="toggle(player.charId, $event)" />
        </div>
      </DetailSection>
    </div>
  </DetailSection>
</template>
<script setup>
import { ColorPresetPicker, CompactCheckbox, DetailSection, FormField, FormTextInput } from '@sylvieshare/share-ui'
import { UserRound } from '@lucide/vue'
import { pvAvatar, pvName } from '@/features/sessions/lib/participantView'
import { ROUTE_COLORS } from '../lib/routes'
const props = defineProps({ route: Object, participants: Array, disabled: Boolean })
const emit = defineEmits(['change'])
function toggle(id, selected) { emit('change', { playerIds: selected ? [...props.route.playerIds, id] : props.route.playerIds.filter(value => value !== id) }) }
</script>
<style scoped>
.global-route-settings { display: flex; flex-direction: column; gap: 10px; }
.global-route-player { display: flex; gap: 8px; align-items: center; padding-block: 5px; }
.global-route-player-name { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 12px; color: var(--text-1); }
.global-route-player img { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
</style>
