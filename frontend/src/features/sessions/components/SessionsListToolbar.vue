<template>
  <div class="sessions-list-toolbar">
    <form class="session-join-form" @submit.prevent="emit('join')">
      <FormTextInput class="session-code-input" :value="joinCode" :maxlength="11" placeholder="XXXXX-00000" aria-label="Код приглашения в сессию" :aria-invalid="!!error" @update:value="emit('update:joinCode',$event)" />
      <ActionButton type="submit" variant="secondary" :disabled="!joinCode.trim() || joining" :loading="joining" loading-label="Входим">Войти</ActionButton>
      <span v-if="error" class="session-join-error" role="alert">{{ error }}</span>
    </form>
  </div>
</template>
<script setup>
import { ActionButton, FormTextInput } from '@sylvieshare/share-ui'
defineProps({joinCode:{type:String,default:''},joining:Boolean,error:String})
const emit=defineEmits(['update:joinCode','join'])
</script>
<style scoped>
.sessions-list-toolbar {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--spacing-large);min-width:0}
.session-join-form {display:flex;align-items:center;flex-wrap:wrap;gap:var(--spacing-small);flex:0 1 360px;max-width:100%}
.session-code-input {flex:1;min-width:0}
.session-join-error {width:100%;color:var(--danger);font-size:var(--type-context-size)}
</style>
