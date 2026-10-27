<template>
  <AppModal fullscreen :z-index="zIndex" @close="emit('close')">
    <CharacterEditionDialog :controller="edition" />
    <div :inert="edition.busy" class="csm share-app-canvas" :class="{ 'csm--preview': previewMode }">
      <CharEditorToolbar
        modal
        :publicVisible="publicVisible"
        :canEdit="canEdit"
        :canTogglePublic="isOwner"
        :saveStatus="saveStatus"
        :pendingSecondsLeft="pendingSecondsLeft"
        :tabs="toolbarTabs"
        :activeTab="activeTab"
          :toolbarValues="data.values"
        :toolbarVars="data.var"
        :charName="charName"
        :charSub="charSub"
        @update:publicVisible="onPublicToggle"
        @update:activeTab="setActiveTab"
        @update:value="onUpdateValue"
        @update:var="onUpdateVar"
        @close="emit('close')"
      />

      <CharacterSheetTabs v-if="format !== 'desktop'" :tabs="activeTabs" :active-tab="activeTab" @select="setActiveTab" />

      <div v-if="previewMode" class="csm-preview-note">Предпросмотр черновика · только чтение</div>

      <div class="csm-body" :class="{ 'csm-body--pager': compactLayout }">
        <div v-if="loading" class="character-loading">
          <LoadingIndicator label="Загружаем лист персонажа…" size="lg" show-label />
        </div>

        <div v-else-if="loadError" role="alert">{{ loadError }} <button type="button" @click="initializeCharacter">Повторить</button></div>
        <CharacterSwipePager v-else-if="template && compactLayout" ref="swipePagerEl" :controller="swipe" :tabs="activeTabs">
          <template #default="{ index }">
            <div class="container" :style="containerWidthForTab(index)">
              <CharacterTabPane :definition="template" :format="format" :section="activeTabs[index]?.id"
                :values="data.values" :vars="data.var" @update:value="onUpdateValue" @update:var="onUpdateVar" />
            </div>
          </template>
        </CharacterSwipePager>
        <div v-else-if="template" class="desktop-tabs">
          <div
            v-for="index in (format === 'desktop' && template.system === 'dnd5e' ? [0] : visitedTabIndexes)"
            :key="'csm-tab-' + index"
            v-show="format === 'desktop' && template.system === 'dnd5e' || index === activeTab"
            class="container"
            :style="containerWidthForTab(index)"
          >
            <CharacterTabPane :definition="template" :format="format" :section="activeTabs[format === 'desktop' && template.system === 'dnd5e' ? activeTab : index]?.id"
              :values="data.values" :vars="data.var" @select-tab="setActiveTab"
              @update:value="onUpdateValue" @update:var="onUpdateVar" />
          </div>
        </div>
      </div>

      <CharacterSaveErrorToast
        :visible="saveStatus === 'error' && !!saveError"
        :message="saveError"
        @retry="retrySave" @reload="reloadSave"
        @dismiss="dismissSaveError"
      />
    </div>
  </AppModal>
</template>

<script setup>
import { LoadingIndicator } from '@sylvieshare/share-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { AppModal } from '@sylvieshare/share-ui'
import CharEditorToolbar from '@/features/character-editor/components/CharEditorToolbar'
import CharacterSaveErrorToast from '@/features/character-editor/components/CharacterSaveErrorToast.vue'
import CharacterTabPane from './CharacterTabPane.vue'
import { useAppLayout } from '@/shared/composables/useAppLayout'
import { sheetTabIndex, sheetTabs } from '../lib/sheetPresentation'
import CharacterSheetTabs from './sheet/CharacterSheetTabs.vue'
import CharacterSwipePager from './sheet/CharacterSwipePager.vue'
import { useTabSwipe } from '../composables/useTabSwipe'
import { useCharacterData } from '@/features/character-editor/composables/useCharacterData'
import CharacterEditionDialog from './CharacterEditionDialog.vue'
import { useCharacterEdition } from '@/features/character-editor/composables/useCharacterEdition'
import { useCharacterLive } from '@/features/character-editor/composables/useCharacterLive'
import { useSaveDebounce } from '@/features/character-editor/composables/useSaveDebounce'
import { useSessionEventsStore } from '@/stores/sessionEvents'

const props = defineProps({
  uuid: { type: String, default: '' },
  draft: { type: Object, default: null },
  isDm: { type: Boolean, default: false },
  zIndex: { type: Number, default: 3000 },
})
const emit = defineEmits(['close'])
const sessionEventsStore = useSessionEventsStore()
const previewMode = computed(() => Boolean(props.draft))
const { format: windowFormat } = useAppLayout()
// A modal opens on identity/HP even on a phone, then offers compact content tabs.
const format = computed(() => windowFormat.value === 'phone' ? 'tablet' : windowFormat.value)

const {
  loading, loadError, template, data, charCtx, isOwner, publicVisible, version, serverDocument, sourceVersionId, applyCharacter, applyMetadata,
  activeTabs, toolbarTabs, charName, charSub,
  load, loadPreview, containerWidthForTab, getInitialTabs,
  updateValue, updateValues, updateVar, onPublicToggle: updatePublicVisible,
} = useCharacterData(props.uuid, format)

const pendingSessionEvents = []
const { saveStatus, saveError, pendingSecondsLeft, scheduleSave, retrySave, dismissSaveError, reloadSave, flushSave, sync: documentSync } = useSaveDebounce(props.uuid, data, {
  version, serverDocument, canSave:()=>!previewMode.value && (isOwner.value || props.isDm),
  takeEvents: () => pendingSessionEvents.splice(0),
  onMetadata: applyMetadata,
})

useCharacterLive({ uuid: computed(() => props.uuid), sessionUuid: computed(() => previewMode.value ? null : sessionEventsStore.sessionUuid), sync: documentSync, onMetadata: applyMetadata })

const edition = useCharacterEdition({ uuid: props.uuid, isOwner: computed(() => isOwner.value && !previewMode.value), sourceVersionId, version, flushSave, applyCharacter })
charCtx.edition = edition

const canEdit = computed(() => !previewMode.value && (isOwner.value || props.isDm))

function updateValuesAndSave(patch) {
  if (!canEdit.value) return
  updateValues(patch)
  scheduleSave()
}

charCtx.updateValues = updateValuesAndSave

charCtx.logSessionEvent = event => {
  if (previewMode.value) return
  const pending = sessionEventsStore.pendingCharacterEvent(event)
  if (pending) {
    pendingSessionEvents.push(pending)
    scheduleSave()
  }
}

const compactLayout = computed(() => format.value !== 'desktop')
const swipePagerEl = ref(null)
const swipe = useTabSwipe(activeTabs, compactLayout)
const { activeTab, visitedTabIndexes, markTabVisited, resetSwipe } = swipe
watch(format, (next, previous) => {
  const id = sheetTabs(template.value, previous)[activeTab.value]?.id
  resetSwipe()
  activeTab.value = sheetTabIndex(activeTabs.value, id)
  markTabVisited(activeTab.value)
}, { flush: 'sync' })

function setActiveTab(value) {
  const index = typeof value === 'string' ? sheetTabIndex(activeTabs.value, value) : value
  markTabVisited(index)
  swipe.setActiveTab(index, swipePagerEl.value?.trackElement())
}

function onPublicToggle(value) {
  if (previewMode.value) return
  updatePublicVisible(value)
}

function onUpdateValue(event) {
  if (previewMode.value) return
  updateValue(event)
  scheduleSave()
}

function onUpdateVar(patch) {
  if (previewMode.value) return
  updateVar(patch)
  scheduleSave()
}

async function initializeCharacter() {
  if (previewMode.value) loadPreview(props.draft)
  else if (!await load()) return
  charCtx.ownerMode = canEdit.value
  const tabs = getInitialTabs()
  const defaultIdx = tabs.findIndex(tab => tab.default)
  setActiveTab(defaultIdx >= 0 ? defaultIdx : 0)
}
onMounted(initializeCharacter)
</script>

<style scoped>
.csm { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.csm-preview-note { flex: none; padding: 5px 14px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--accent) 8%, var(--bg)); color: var(--accent-soft); font-size: 10px; font-weight: 700; letter-spacing: .04em; text-align: center; text-transform: uppercase; }
.csm--preview .desktop-tabs :deep(button[title='Редактировать']) { display: none; }
.csm-body { flex: 1; min-height: 0; overflow-x: auto; overflow-y: auto; background: transparent; }
.csm-body--pager { overflow: hidden; }
.csm-body--pager .container { padding: 0; }
.container { box-sizing: border-box; width: 100%; margin: 0 auto; padding: 18px 16px 28px; background: transparent; }
.desktop-tabs { display: flex; flex-direction: column; min-height: 100%; }
.desktop-tabs > .container { display: flex; flex: 1 1 auto; flex-direction: column; width: 100%; min-height: 0; }
.character-loading { min-height: 100%; display: grid; place-items: center; padding: 32px; box-sizing: border-box; }
</style>
