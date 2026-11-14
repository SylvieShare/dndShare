<template>
  <WorkspaceHeader ref="workspace" v-bind="$attrs" class="character-workspace-header" :scroll-source="null" :context-placement="format === 'phone' ? 'row' : 'auto'"
    :class="{ 'character-workspace-header--compact': compact }" :content-width="contentWidth" :fit-navigation="format !== 'phone'"
    :navigation-placement="dnd && format === 'desktop' ? 'external' : 'below'"
    :navigation-joined="dnd && format === 'desktop'" row-dividers
    :navigation-target="dnd && format === 'desktop' ? navigationTarget : undefined">
    <template #identity>
      <ActionButton variant="quiet" :icon-only="compact" :aria-label="modal ? 'Закрыть лист' : 'К списку персонажей'" @click="modal ? emit('close') : router.push('/chars')">
        <template #icon><ArrowLeft :size="18" /></template>
        <span v-if="!compact">{{ modal ? 'Закрыть' : 'Персонажи' }}</span>
      </ActionButton>
      <DndSheetHeading v-if="dnd" :name="name" :subtitle="subtitle" :icon-url="iconUrl" @open="openHeading" />
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
    <template v-if="dnd && hasConditions" #context>
      <div class="character-summary-strip">
        <DndSheetStrip />
      </div>
    </template>
    <template v-if="tabs.length" #navigation>
      <CharacterSheetTabs :format="dnd && format === 'desktop' ? 'tablet' : format" :tabs="tabs" :active-tab="activeTab" :selection="selection" :animate="animateNavigation" @select="emit('select-tab', $event)" />
    </template>
    <template #actions>
      <div class="heading-tools">
        <CharacterHeaderSessionMenu v-if="!modal && session && transfers" :session="session" :controller="transfers" />
        <template v-if="dnd">
          <CharacterBlock block-id="rest" :options="{ embedded: true, header: true }" />
          <CharacterBlock block-id="settings" :options="{ header: true }" />
        </template>
      </div>
      <SettingsMenuTile v-if="showMenu" :block="{ props: { embedded: true } }" />
      <div v-if="dnd" class="heading-editors">
        <CharacterBlock ref="profileEditor" block-id="char_identity" :options="{ editorOnly: true }" />
        <CharacterBlock ref="experienceEditor" block-id="lvl" :options="{ editorOnly: true }" />
        <CharacterBlock ref="healthEditor" block-id="hp" :options="{ editorOnly: true }" />
        <CharacterBlock ref="armorEditor" block-id="armor" :options="{ editorOnly: true }" />
        <CharacterBlock ref="statusEditor" block-id="desktop_status_trigger" :options="{ editorOnly: true }" />
      </div>
    </template>
  </WorkspaceHeader>
</template>
<script setup>
defineOptions({ inheritAttrs: false })
import CharacterBlock from './CharacterBlock.vue'
import { useRouter } from 'vue-router'
import { computed, inject, ref, watch } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import { ArrowLeft } from '@lucide/vue'
import WorkspaceHeader from '@/shared/ui/WorkspaceHeader.vue'
import CharacterHeaderSessionMenu from './CharacterHeaderSessionMenu.vue'
import SettingsMenuTile from '../blocks/generic/SettingsMenuTile.vue'
import CharacterSheetTabs from './sheet/CharacterSheetTabs.vue'
import DndSheetHeading from './sheet/DndSheetHeading.vue'
import DndSheetStrip from './sheet/DndSheetStrip.vue'
import { isInspirationActive } from '../blocks/dnd/lib/mobileStatus'
const props = defineProps({ dnd: Boolean, format: String, modal: Boolean, contentWidth: String, name: String, subtitle: String, iconUrl: String, session: Object, transfers: Object, compact: Boolean, showMenu: Boolean,
  navigationTarget: Object, selection: Array, animateNavigation: { type: Boolean, default: true },
  tabs: { type: Array, default: () => [] }, activeTab: Number })
const emit = defineEmits(['select-tab', 'close'])
const charCtx = inject('charCtx', {})
const hasConditions = computed(() => !!(charCtx.characterStatuses?.entries?.length || charCtx.values?.exhaustion?.level > 0 || isInspirationActive(charCtx.values?.inspiration)))
const workspace = ref(null)
const profileEditor = ref(null), experienceEditor = ref(null), healthEditor = ref(null), armorEditor = ref(null), statusEditor = ref(null)
function openHeading(target) {
  const editors = { profile: profileEditor, experience: experienceEditor, health: healthEditor, armor: armorEditor, 'add-status': statusEditor }
  editors[target]?.value?.open()
}
function setScrollPosition(value) {
  workspace.value?.setScrollPosition(value)
}
defineExpose({ setScrollPosition })
const router = useRouter()
const iconFailed = ref(false)
const monogram = computed(() => Array.from(String(props.name || '').trim())[0]?.toUpperCase() || '?')
watch(() => props.iconUrl, () => { iconFailed.value = false })
</script>
<style scoped>
.heading-editors {position:absolute;width:0;height:0}
.heading-tools {display:flex;align-items:center;gap:2px;flex:none}
.character-summary-strip {position:relative;z-index:1}
.character-workspace-header:not(.workspace-header--context-inline) .character-summary-strip {
  --status-scroll-inset-start: var(--workspace-context-inset-start, var(--spacing-page));
  --status-scroll-inset-end: var(--workspace-context-inset-end, var(--spacing-page));
  margin-inline-start: calc(-1 * var(--status-scroll-inset-start));
  margin-inline-end: calc(-1 * var(--status-scroll-inset-end));
}
.character-workspace-header {
  --workspace-header-identity-gap: var(--spacing-small);
  --workspace-header-context-gap: var(--spacing-small);
  --workspace-context-inline-offset: var(--spacing-large);
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
@media (--ui-phone) { .character-workspace-header { --workspace-header-column-gap: var(--spacing-xs); --workspace-header-identity-gap: var(--spacing-xs); } }
@media (--ui-compact) { .character-identity { padding-left: 0; border-left: 0; } }
</style>
