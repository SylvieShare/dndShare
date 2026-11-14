<template>
  <span class="players-connection" role="status" :aria-label="connectionLabel" :title="connectionLabel" :style="{ background: connectionColor }" />
  <RowActionMenu title="Действия с игроками" follow-anchor>
    <template #trigger="{ open }">
      <ActionButton variant="dashed" icon-only aria-label="Действия с игроками" aria-haspopup="menu" :aria-expanded="open">
        <template #icon><Plus :size="20" :stroke-width="2" aria-hidden="true" /></template>
      </ActionButton>
    </template>
    <template #default="{ close }">
      <RowActionItem action="join" @click="select('join',close)">Присоединить своего персонажа</RowActionItem>
      <RowActionItem action="create" @click="select('create',close)">Создать персонажа</RowActionItem>
      <RowActionItem action="copy" @click="select('copy-code',close)">Скопировать код приглашения</RowActionItem>
      <RowActionItem action="copy-link" @click="select('copy-link',close)">Скопировать ссылку приглашения</RowActionItem>
    </template>
  </RowActionMenu>
</template>
<script setup>
import { computed } from 'vue'
import { ActionButton, RowActionMenu } from '@sylvieshare/share-ui'
import { Plus } from '@lucide/vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
const props = defineProps({ liveStatus:String, syncStatus:String, syncing:Boolean })
const emit = defineEmits(['join','create','copy-code','copy-link'])
const connectionLabel = computed(()=>props.syncStatus==='error' ? 'Ошибка синхронизации сессии' : props.liveStatus==='connected' ? props.syncing ? 'Синхронизация сессии' : 'Сессия синхронизирована' : 'Восстанавливаем связь с сессией')
const connectionColor = computed(()=>props.syncStatus==='error' ? 'var(--danger)' : props.liveStatus==='connected'&&!props.syncing ? 'var(--success)' : 'var(--warning)')
function select(action,close){close();emit(action)}
</script>
<style scoped>
.players-connection {flex:none;width:6px;height:6px;border-radius:50%;transition:background var(--motion-feedback)}
</style>
