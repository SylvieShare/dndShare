<template>
  <div v-if="actions" class="reserve-header-actions">
    <ActionButton v-if="ui.editing" variant="quiet" icon-only aria-label="Сохранить название вкладки" title="Сохранить название" @click="ui.saveName"><template #icon><Check :size="18" /></template></ActionButton>
    <template v-else-if="!ui.active.permanent">
      <ActionButton variant="quiet" icon-only aria-label="Переименовать вкладку" title="Переименовать вкладку" @click="ui.startRename"><template #icon><Pencil :size="18" /></template></ActionButton>
      <RemoveButton icon="trash" label="Удалить вкладку" @click="ui.requestDelete" />
    </template>
  </div>
  <div v-else class="reserve-header-title">
    <FormTextInput v-if="ui.editing" v-model:value="ui.draftName" autofocus :maxlength="255" aria-label="Название вкладки запаса"
      @enter="ui.saveName" @blur="ui.saveName" @keydown.esc.stop.prevent="ui.cancelName" />
    <strong v-else :title="ui.active.name">{{ ui.active.name }}</strong>
  </div>
</template>
<script setup>
import { ActionButton, FormTextInput, RemoveButton } from '@sylvieshare/share-ui'
import { Check, Pencil } from '@lucide/vue'
defineProps({ui:{type:Object,required:true},actions:Boolean})
</script>
<style scoped>
.reserve-header-title {flex:1;min-width:0}
.reserve-header-title strong {display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.reserve-header-actions {display:flex;align-items:center;gap:var(--spacing-xs)}
</style>
