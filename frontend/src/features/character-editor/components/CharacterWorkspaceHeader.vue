<template>
  <WorkspaceHeader class="character-workspace-header" :class="{ 'character-workspace-header--compact': compact }" :content-width="contentWidth" :split-navigation="stackedNavigation">
    <template #identity>
      <ActionButton variant="quiet" :icon-only="compact" aria-label="К списку персонажей" @click="router.push('/chars')">
        <template #icon><ArrowLeft :size="18" /></template>
        <span v-if="!compact">Персонажи</span>
      </ActionButton>
      <div class="character-identity">
        <div class="character-heading-icon" role="img" aria-label="Иконка персонажа">
          <img v-if="iconUrl && !iconFailed" :key="iconUrl" :src="iconUrl" alt="" @error="iconFailed = true" />
          <span v-else aria-hidden="true">{{ monogram }}</span>
        </div>
        <div class="character-heading">
          <h1 :title="name">{{ name || 'Лист персонажа' }}</h1>
          <span v-if="subtitle" :title="subtitle">{{ subtitle }}</span>
        </div>
      </div>
    </template>
    <template v-if="tabs.length" #navigation>
      <CharacterSheetTabs :pill="compact || stackedNavigation" :tabs="tabs" :active-tab="activeTab" @select="emit('select-tab', $event)" />
    </template>
    <template #actions>
      <SettingsMenuTile v-if="showMenu" :block="{ props: { embedded: true } }" />
      <CharacterSessionControl compact :session="session" :controller="transfers" />
    </template>
  </WorkspaceHeader>
</template>
<script setup>
import { useRouter } from 'vue-router'
import { computed, ref, watch } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import { ArrowLeft } from '@lucide/vue'
import WorkspaceHeader from '@/shared/ui/WorkspaceHeader.vue'
import CharacterSessionControl from './CharacterSessionControl.vue'
import SettingsMenuTile from '../blocks/generic/SettingsMenuTile.vue'
import CharacterSheetTabs from './sheet/CharacterSheetTabs.vue'
const props = defineProps({ contentWidth: String, name: String, subtitle: String, iconUrl: String, session: Object, transfers: Object, stackedNavigation: Boolean, compact: Boolean, showMenu: Boolean,
  tabs: { type: Array, default: () => [] }, activeTab: Number })
const emit = defineEmits(['select-tab'])
const router = useRouter()
const iconFailed = ref(false)
const monogram = computed(() => Array.from(String(props.name || '').trim())[0]?.toUpperCase() || '?')
watch(() => props.iconUrl, () => { iconFailed.value = false })
</script>
<style scoped>
.character-workspace-header {
  --workspace-header-identity-gap: var(--spacing-small);
  --workspace-subheader-background: var(--surface);
  --workspace-subheader-radius: var(--radius-tile);
  --workspace-subheader-inset: var(--spacing-page);
  --workspace-subheader-padding: 0px;
}
.character-identity {
  display: flex;
  align-items: center;
  gap: var(--spacing-label);
  min-width: 0;
  padding-left: var(--spacing-medium);
  border-left: 1px solid var(--border);
}
.character-heading-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: var(--layout-sheet-header-icon);
  height: var(--layout-sheet-header-icon);
  overflow: hidden;
  border-radius: var(--radius-input);
  background: var(--surface-raised);
  color: var(--accent-soft);
  font-size: var(--type-sheet-header-size);
  font-weight: var(--type-sheet-header-weight);
}
.character-heading-icon img { width: 100%; height: 100%; object-fit: cover; }
.character-heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.character-heading h1, .character-heading span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.character-heading h1 {
  margin: 0;
  color: var(--text-1);
  font-family: var(--type-sheet-header-family); font-size: var(--type-sheet-header-size); font-weight: var(--type-sheet-header-weight); line-height: var(--type-sheet-header-line-height);
}
.character-heading span {
  color: var(--text-muted);
  font-size: var(--type-context-size);
  line-height: var(--type-context-line-height);
}
.character-workspace-header--compact .character-identity { padding-left: 0; border-left: 0; }
@media (--ui-compact) { .character-identity { padding-left: 0; border-left: 0; } }
</style>
