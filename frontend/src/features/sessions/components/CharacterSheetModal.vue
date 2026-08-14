<template>
  <AppModal fullscreen :z-index="zIndex" @close="emit('close')">
    <div class="csm">
      <CharEditorToolbar
        modal
        :publicVisible="publicVisible"
        :canEdit="canEdit"
        :canTogglePublic="isOwner"
        :saveStatus="saveStatus"
        :pendingSecondsLeft="pendingSecondsLeft"
        :tabs="toolbarTabs"
        :activeTab="activeTab"
        :toolbarBlocksList="toolbarBlocksList"
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

      <div class="csm-body">
        <div v-if="loading" class="container sk-container">
          <div class="sk-block" style="width:100%; height:52px" />
          <div class="sk-block" style="width:180px; height:160px" />
          <div class="sk-block" style="width:180px; height:160px" />
          <div class="sk-block" style="width:100%; height:90px" />
        </div>

        <div v-else-if="template" class="desktop-tabs">
          <div
            v-for="index in visitedTabIndexes"
            :key="'csm-tab-' + index"
            v-show="index === activeTab"
            class="container"
            :style="containerWidthForTab(index)"
          >
            <TemplateBlockInner
              v-for="(block, bi) in blocksForTab(index)"
              :key="bi"
              :block="block"
              :values="data.values"
              :vars="data.var"
              @update:value="onUpdateValue"
              @update:var="onUpdateVar"
            />
          </div>
        </div>
      </div>
    </div>
  </AppModal>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import AppModal from '@/shared/ui/AppModal'
import CharEditorToolbar from '@/features/character-editor/components/CharEditorToolbar'
import TemplateBlockInner from '@/features/character-editor/components/TemplateBlockInner'
import { useCharacterData } from '@/features/character-editor/composables/useCharacterData'
import { useSaveDebounce } from '@/features/character-editor/composables/useSaveDebounce'
import { useSessionEventsStore } from '@/stores/sessionEvents'

const props = defineProps({
  uuid: { type: String, required: true },
  isDm: { type: Boolean, default: false },
  zIndex: { type: Number, default: 3000 },
})
const emit = defineEmits(['close'])
const sessionEventsStore = useSessionEventsStore()

const isMobile = ref(false)

const {
  loading, template, data, charCtx, isOwner, publicVisible,
  toolbarTabs, charName, charSub, toolbarBlocksList,
  load, blocksForTab, containerWidthForTab, getInitialTabs,
  updateValue, updateVar, onPublicToggle,
} = useCharacterData(props.uuid, isMobile)

const pendingSessionEvents = []
const { saveStatus, pendingSecondsLeft, scheduleSave } = useSaveDebounce(props.uuid, data, {
  takeEvents: () => pendingSessionEvents.splice(0),
  restoreEvents: events => pendingSessionEvents.unshift(...events),
})

charCtx.logSessionEvent = event => {
  const pending = sessionEventsStore.pendingCharacterEvent(event)
  if (pending) {
    pendingSessionEvents.push(pending)
    scheduleSave()
  }
}

const canEdit = computed(() => isOwner.value || props.isDm)

const activeTab = ref(0)
const visited = ref(new Set([0]))
const visitedTabIndexes = computed(() => [...visited.value])

function setActiveTab(index) {
  activeTab.value = index
  visited.value = new Set([...visited.value, index])
}

function onUpdateValue(event) {
  updateValue(event)
  scheduleSave()
}

function onUpdateVar(patch) {
  updateVar(patch)
  scheduleSave()
}

onMounted(async () => {
  await load()
  charCtx.ownerMode = canEdit.value
  const tabs = getInitialTabs()
  const defaultIdx = tabs.findIndex(t => t.default)
  setActiveTab(defaultIdx >= 0 ? defaultIdx : 0)
})
</script>

<style scoped>
.csm {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg);
}

.csm-body {
  flex: 1;
  min-height: 0;
  overflow-x: auto;
  overflow-y: auto;
  background: var(--bg);
}

.container {
  margin: 0 auto;
  padding: 18px 16px 28px;
  background: var(--bg);
}

.desktop-tabs {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.desktop-tabs > .container {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  width: 100%;
  min-height: 0;
}

.sk-container {
  max-width: 900px;
}

.sk-block {
  border-radius: 12px;
  background: var(--popover-bg);
  margin-bottom: 12px;
  animation: sk-pulse 1.4s ease-in-out infinite;
}

@keyframes sk-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
</style>
