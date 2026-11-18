<template>
  <div v-if="actions" class="reserve-header-actions">
    <ActionButton v-if="ui.editing" variant="quiet" icon-only aria-label="Сохранить название вкладки" title="Сохранить название" @click="ui.saveName"><template #icon><Check :size="20" aria-hidden="true" /></template></ActionButton>
    <template v-else-if="!ui.active.permanent">
      <ActionButton variant="quiet" icon-only aria-label="Переименовать вкладку" title="Переименовать вкладку" @click="ui.startRename"><template #icon><Pencil :size="20" aria-hidden="true" /></template></ActionButton>
      <ActionButton class="reserve-header-delete" variant="quiet" icon-only aria-label="Удалить вкладку" title="Удалить вкладку" @click="ui.requestDelete"><template #icon><Trash2 :size="20" aria-hidden="true" /></template></ActionButton>
    </template>
    <RowActionMenu v-if="!ui.editing" title="Добавить существо" follow-anchor :disabled="!encounter.canManageReserves">
      <template #trigger="{open}"><ActionButton variant="dashed" icon-only aria-label="Добавить существо" aria-haspopup="menu" :aria-expanded="open" :disabled="!encounter.canManageReserves"><template #icon><Plus :size="20" aria-hidden="true" /></template></ActionButton></template>
      <template #default="{close}">
        <RowActionItem :icon="Plus" @click="close();encounter.showSimpleForm=true">Создать упрощённое существо</RowActionItem>
        <RowActionItem v-if="!encounter.isRed" :icon="BookOpen" @click="close();encounter.showNpcPicker=true">Добавить из справочника</RowActionItem>
      </template>
    </RowActionMenu>
  </div>
  <div v-else class="reserve-header-title">
    <FormTextInput v-if="ui.editing" v-model:value="ui.draftName" autofocus :maxlength="255" aria-label="Название вкладки запаса"
                   @enter="ui.saveName" @blur="ui.saveName" @keydown.esc.stop.prevent="ui.cancelName" />
    <strong v-else :title="ui.active.name">{{ ui.active.name }}</strong>
  </div>
</template>
<script setup>
import { ActionButton, FormTextInput, RowActionMenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { BookOpen, Check, Pencil, Plus, Trash2 } from '@lucide/vue'
defineProps({ui:{type:Object,required:true},encounter:{type:Object,required:true},actions:Boolean})
</script>
<style scoped>
.reserve-header-title {flex:1;min-width:0}
.reserve-header-title strong {display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.reserve-header-actions {display:flex;align-items:center;gap:var(--spacing-xs)}
.reserve-header-delete:hover:not(:disabled) {color:var(--danger)}
</style>
