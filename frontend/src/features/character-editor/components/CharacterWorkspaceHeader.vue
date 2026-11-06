<template>
  <WorkspaceHeader v-bind="$attrs" class="character-workspace-header" :class="{ 'character-workspace-header--compact': compact }" :content-width="contentWidth" :split-navigation="stackedNavigation">
    <template #identity>
      <ActionButton variant="quiet" :icon-only="compact" :aria-label="modal ? 'Закрыть лист' : 'К списку персонажей'" @click="modal ? emit('close') : router.push('/chars')">
        <template #icon><ArrowLeft :size="18" /></template>
        <span v-if="!compact">{{ modal ? 'Закрыть' : 'Персонажи' }}</span>
      </ActionButton>
      <DndSheetHeading v-if="dnd" :name="name" :subtitle="subtitle" :icon-url="iconUrl" :wide="format === 'desktop'" @open="panel = $event" />
      <div v-else class="character-identity">
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
    <template v-if="dnd && format !== 'desktop'" #between>
      <div class="character-summary-strip" :class="{ 'is-collapsed': scrolled }" :inert="scrolled" :aria-hidden="scrolled || undefined">
        <div class="summary-clip"><DndSheetStrip :format="format" @open="panel = $event" /></div>
      </div>
    </template>
    <template v-if="tabs.length" #navigation>
      <CharacterSheetTabs :pill="compact || stackedNavigation" :tabs="tabs" :active-tab="activeTab" @select="emit('select-tab', $event)" />
    </template>
    <template #actions>
      <ActionButton v-if="dnd && format !== 'desktop' && scrolled" variant="quiet" icon-only aria-label="Сводка персонажа" @click="panel = 'summary'"><template #icon><Ellipsis :size="18" /></template></ActionButton>
      <SettingsMenuTile v-if="showMenu" :block="{ props: { embedded: true } }" />
  <DndOverviewDialog v-if="dnd && panel" :panel="panel" @open="panel = $event" @close="panel = ''" />
      <CharacterSessionControl v-if="!modal" compact :session="session" :controller="transfers" />
    </template>
  </WorkspaceHeader>
</template>
<script setup>
defineOptions({ inheritAttrs: false })
import { useTutorialAction } from '@/features/tutorials/composables/useTutorialAction'
import { useRouter } from 'vue-router'
import { computed, nextTick, ref, watch } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import { ArrowLeft, Ellipsis } from '@lucide/vue'
import WorkspaceHeader from '@/shared/ui/WorkspaceHeader.vue'
import CharacterSessionControl from './CharacterSessionControl.vue'
import SettingsMenuTile from '../blocks/generic/SettingsMenuTile.vue'
import CharacterSheetTabs from './sheet/CharacterSheetTabs.vue'
import DndSheetHeading from './sheet/DndSheetHeading.vue'
import DndSheetStrip from './sheet/DndSheetStrip.vue'
import DndOverviewDialog from './sheet/DndOverviewDialog.vue'
const props = defineProps({ dnd: Boolean, format: String, scrolled: Boolean, modal: Boolean, contentWidth: String, name: String, subtitle: String, iconUrl: String, session: Object, transfers: Object, stackedNavigation: Boolean, compact: Boolean, showMenu: Boolean,
  tabs: { type: Array, default: () => [] }, activeTab: Number })
const emit = defineEmits(['select-tab', 'close'])
const panel = ref('')
useTutorialAction('character-overview', async ({ onCleanup }) => {
  const previous = panel.value
  panel.value = 'summary'
  onCleanup(() => { panel.value = previous })
  await nextTick()
})
const router = useRouter()
const iconFailed = ref(false)
const monogram = computed(() => Array.from(String(props.name || '').trim())[0]?.toUpperCase() || '?')
watch(() => props.iconUrl, () => { iconFailed.value = false })
</script>
<style scoped>
.character-summary-strip { position:relative; z-index:1; display:grid; grid-template-rows:1fr; transition:grid-template-rows var(--motion-navigation) }
.character-summary-strip.is-collapsed { grid-template-rows:0fr }
.summary-clip { min-height:0; overflow:hidden }
@media (prefers-reduced-motion: reduce) { .character-summary-strip { transition:none } }
.character-workspace-header {
  --workspace-header-identity-gap: var(--spacing-small);
  --workspace-subheader-background: var(--surface-raised);
  --workspace-subheader-radius: var(--radius-tile);
  --workspace-subheader-inset: var(--spacing-page);
  --workspace-subheader-padding: 0px;
  --workspace-subheader-shadow: 0 var(--spacing-xs) var(--radius-medium) color-mix(in srgb, var(--scrim) 30%, transparent);
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
