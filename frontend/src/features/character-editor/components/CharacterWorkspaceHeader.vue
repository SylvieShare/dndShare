<template>
  <WorkspaceHeader class="character-workspace-header" :content-width="contentWidth" :split-navigation="stackedNavigation">
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
    <template v-if="tabs.length" #navigation>
      <CharacterSheetTabs :tabs="tabs" :active-tab="activeTab" @select="emit('select-tab', $event)" />
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
import CharacterSheetTabs from './sheet/CharacterSheetTabs.vue'
defineProps({ contentWidth: String, name: String, subtitle: String, session: Object, transfers: Object, stackedNavigation: Boolean,
  tabs: { type: Array, default: () => [] }, activeTab: Number })
const emit = defineEmits(['select-tab'])
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
  font-family: var(--type-header-family); font-size: var(--type-header-size); font-weight: var(--type-header-weight); line-height: var(--type-header-line-height);
}
.character-heading span {
  color: var(--text-muted);
  font-size: var(--type-context-size);
  line-height: var(--type-context-line-height);
}
</style>
