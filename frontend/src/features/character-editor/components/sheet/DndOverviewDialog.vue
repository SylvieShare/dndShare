<template>
  <AppModalFrame :title="titles[panel]" @close="emit('close')">
    <div v-if="panel === 'profile'" class="profile-details"><CharacterBlock block-id="character_icon" /><CharacterBlock block-id="char_identity" /></div>
    <CharacterBlock v-if="panel === 'profile'" block-id="lvl" />
    <div v-else-if="panel === 'statuses'"><CharacterBlock block-id="mobile_statuses" /><p v-if="!hasStates" class="empty">Нет активных состояний</p></div>
    <DndUtilities v-else />
    <div v-if="panel !== 'statuses'" class="overview-actions">
      <ActionButton v-if="panel !== 'profile'" variant="quiet" @click="emit('open', 'profile')">Профиль персонажа</ActionButton>
      <ActionButton variant="quiet" @click="emit('open', 'statuses')">Состояния</ActionButton>
      <ActionButton v-if="panel === 'profile'" variant="quiet" @click="emit('open', 'summary')">Сводка персонажа</ActionButton>
    </div>
  </AppModalFrame>
</template>
<script setup>
import { AppModalFrame, ActionButton } from '@sylvieshare/share-ui'
import { computed, inject } from 'vue'
import { isInspirationActive } from '../../blocks/dnd/lib/mobileStatus'
import CharacterBlock from '../CharacterBlock.vue'
import DndUtilities from './DndUtilities.vue'
defineProps({panel: String})
const emit = defineEmits(['open','close'])
const ctx = inject('charCtx', {})
const hasStates = computed(() => ctx.characterStatuses?.entries?.length || ctx.values?.exhaustion?.level > 0 || isInspirationActive(ctx.values?.inspiration))
const titles = { profile: 'Профиль персонажа', statuses: 'Состояния', summary: 'Сводка персонажа' }
</script>
<style scoped>
.profile-details,.overview-actions { display:flex;align-items:center;gap:var(--spacing-label);flex-wrap:wrap }
.profile-details > :last-child {flex:1;min-width:140px}
</style>
