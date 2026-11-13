<template>
  <div class="sessions-list-toolbar">
    <div class="sessions-list-filters">
      <WorkspaceNavigation :model-value="filter" :items="items" label="Категории сессий" @update:model-value="emit('update:filter',$event)" />
      <span v-if="count" class="session-count" :aria-label="`Всего сессий: ${count}`">{{ count }}</span>
    </div>
    <form v-if="showJoin" class="session-join-form" @submit.prevent="emit('join')">
      <FormTextInput class="session-code-input" :value="joinCode" :maxlength="11" placeholder="XXXXX-00000" aria-label="Код приглашения в сессию" :aria-invalid="!!error" @update:value="emit('update:joinCode',$event)" />
      <ActionButton type="submit" variant="secondary" :disabled="!joinCode.trim() || joining" :loading="joining" loading-label="Входим">Войти</ActionButton>
      <span v-if="error" class="session-join-error" role="alert">{{ error }}</span>
    </form>
  </div>
</template>
<script setup>
import { ActionButton, FormTextInput } from '@sylvieshare/share-ui'
import WorkspaceNavigation from '@/shared/ui/WorkspaceNavigation.vue'
defineProps({items:{type:Array,required:true},filter:String,count:Number,joinCode:{type:String,default:''},joining:Boolean,error:String,showJoin:Boolean})
const emit=defineEmits(['update:filter','update:joinCode','join'])
</script>
<style scoped>
.sessions-list-toolbar {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--spacing-large);min-width:0}
.sessions-list-filters {display:flex;align-items:center;gap:var(--spacing-small);min-width:0;max-width:100%}
.session-count {padding:var(--spacing-xs) var(--spacing-small);border-radius:var(--radius-badge);background:var(--surface);color:var(--text-muted);font-size:var(--type-context-size)}
.session-join-form {display:flex;align-items:center;flex-wrap:wrap;gap:var(--spacing-small);flex:0 1 360px;max-width:100%}
.session-code-input {flex:1;min-width:0}
.session-join-error {width:100%;color:var(--danger);font-size:var(--type-context-size)}
</style>
