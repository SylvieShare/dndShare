<template>
  <WorkspaceHeader class="character-workspace-header">
    <template #identity>
      <ActionButton variant="quiet" aria-label="К списку персонажей" @click="router.push('/chars')">
        <template #icon><ArrowLeft :size="18" /></template>
        Персонажи
      </ActionButton>
      <div class="character-heading">
        <h1 :title="name">{{ name || 'Лист персонажа' }}</h1>
        <span v-if="subtitle" :title="subtitle">{{ subtitle }}</span>
      </div>
    </template>
    <template #actions>
      <CharacterSessionControl compact :session="session" :controller="transfers" />
    </template>
  </WorkspaceHeader>
</template>
<script setup>
import { useRouter } from 'vue-router'
import { ActionButton } from '@sylvieshare/share-ui'
import { ArrowLeft } from '@lucide/vue'
import WorkspaceHeader from '@/shared/ui/WorkspaceHeader.vue'
import CharacterSessionControl from './CharacterSessionControl.vue'
defineProps({ name: String, subtitle: String, session: Object, transfers: Object })
const router = useRouter()
</script>
<style scoped>
.character-heading {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  margin-left: 14px;
  padding-left: 14px;
  border-left: 1px solid var(--border);
}
.character-heading h1, .character-heading span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.character-heading h1 {
  margin: 0;
  color: var(--text-1);
  font-size: 16px;
  font-weight: 650;
  line-height: 1.3;
}
.character-heading span {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.3;
}
</style>
