<template>
  <div ref="tutorialRoot" class="session-page">
    <PageTutorial :tutorial="sessionTutorial" :mobile="tutorialMobile" />
    <ConfirmDialog
      v-if="pendingKick"
      title="Выгнать игрока?"
      :message="kickError || `${pendingKickName} больше не будет участвовать в этой сессии.`"
      confirm-label="Выгнать"
      loading-label="Исключение…"
      :loading="kickingIds.has(pendingKick.charId)"
      @confirm="confirmKickParticipant"
      @cancel="pendingKick = null"
    />

    <EncounterReviveModal
      v-if="encounter.reviveTarget"
      :key="encounter.reviveTarget.uid"
      :name="encounter.reviveTargetName"
      :max-hp="encounter.reviveTargetMaxHp"
      :saving="encounter.reviveSaving"
      :error="encounter.reviveError"
      @close="encounter.cancelRevive"
      @confirm="encounter.confirmRevive"
    />

    <SessionEditModal
      v-if="editOpen && session"
      :session="session"
      :session-uuid="sessionUuid"
      @close="editOpen = false"
      @saved="applySessionEdit"
    />

    <LoadingState v-if="loading" label="Открываем сессию…" fill />

    <SessionPlayerView
      v-else-if="session && !isDm"
      :session="session"
      :participants="participants"
      :current-chapter="currentChapter"
      :my-char-uuid="myCharUuid"
      :live-status="liveStatus"
    />

    <div
      v-else-if="session"
      class="campaign-workspace"
      :class="{
        'campaign-workspace--combat': primaryView === 'story' && workspaceMotionMode === 'combat',
        'campaign-workspace--players-collapsed': playersRailMode === 'compact',
      }"
    >
      <ChapterGraphTab
        ref="chapterGraphTab"
        class="campaign-graph"
        :graph="chapterGraph"
        :session="session"
        :session-uuid="sessionUuid"
        :is-dm="isDm"
        :locked="!!workspaceMode"
        :primary-view="primaryView"
        :workspace-chapter-id="workspaceChapter?.id ?? null"
        :workspace-scene="workspaceScene"
        :workspace-level="workspaceLevel"
        :workspace-mode="workspaceMode"
        :workspace-layout-mode="workspaceMotionMode"
        :encounter-active="encounter.encounter.active"
        :materials="sessionMaterials"
        :presentation="presentation"
        :timers="sessionTimers"
        :settings="sessionSettings"
        :show-shortcut-hints="showShortcutHints"
        @open-scenes="openChapterScenes"
        @select-view="selectSessionView"
        @open-combat="openCombatTab"
        @update-setting="updateSessionSetting"
        @send-block-to-combat="sendBlockToCombat"
        @workspace-context-change="updateWorkspaceContext"
        @edit-session="openEdit"
        @open-chapters="openChapters"
      >
        <template #primary-workspace>
          <SessionMusicWorkspace v-if="primaryView === 'music'" :is-dm="isDm" />
          <JournalWorkspace v-else-if="primaryView === 'journal'" :session-uuid="sessionUuid" />
          <SessionChronicleWorkspace v-else-if="primaryView === 'events'" :live-status="liveStatus" />
          <SessionWorldLayer
            v-else
            ref="worldLayer"
            :session-uuid="sessionUuid"
            :active-view="primaryView"
            :is-dm="isDm"
            :selected-location-id="selectedLocationId"
            :selected-npc-id="selectedNpcId"
			:selected-quest-id="selectedQuestId"
			:selected-material-id="selectedMaterialId"
			:world="sessionWorld"
            :materials="sessionMaterials"
            :presentation="presentation"
			:show-shortcut-hints="showShortcutHints"
            @select-location="selectLocation"
            @select-npc="selectNpc"
            @select-quest="selectQuest"
			@select-material="selectMaterial"
			@open-scene="openRelatedScene"
          />
        </template>
        <SessionCenterWorkspace
          v-if="workspaceMode === 'combat' && (workspaceMotionMode === 'combat' || workspaceClosing)"
          v-show="primaryView === 'story'"
          ref="combatWorkspace"
          :closing="workspaceClosing"
          :session-uuid="sessionUuid"
          :session="session"
          :participants="participants"
          :is-dm="isDm"
          :encounter="encounter"
          :chapter="workspaceChapter"
          :scene="workspaceScene"
          :show-shortcut-hints="showShortcutHints"
          @view-participant="openParticipant"
          @import-combat-block="importCombatBlock"
        />
        <SessionTimerStack v-if="isDm" :session-uuid="sessionUuid" :timers="sessionTimers" />
      </ChapterGraphTab>

      <div v-if="combatWorkspaceError" class="combat-import-error" role="alert">{{ combatWorkspaceError }}</div>

      <SessionShortcutHelp :active="showShortcutHints" @toggle="showShortcutHints = !showShortcutHints" />

      <aside data-tutorial="session-players" class="workspace-dock workspace-dock--left">
        <div class="col-section-title">
          <span class="players-heading-label">ИГРОКИ</span>
          <button
            v-if="playersRailMode === 'combat'"
            type="button"
            class="players-select-all"
            :class="{ 'players-select-all--active': allEncounterPlayersSelected }"
            :disabled="encounterPlayers.length === 0"
            :title="allEncounterPlayersSelected ? 'Снять выбор со всех игроков' : 'Выбрать всех игроков'"
            :aria-label="allEncounterPlayersSelected ? 'Снять выбор со всех игроков' : 'Выбрать всех игроков'"
            aria-keyshortcuts="Shift+P"
            @click="toggleAllEncounterPlayers"
          >
            <ListChecks :size="17" />
            <kbd v-if="showShortcutHints" class="players-select-all-shortcut">{{ shortcutLabels.panel }}+P</kbd>
          </button>
          <button
            v-if="playersRailMode === 'combat'"
            type="button"
            class="players-select-all players-send-to-combat"
            :disabled="selectedPlayersToCombat.length === 0"
            title="Переместить выбранных игроков в бой"
            aria-label="Переместить выбранных игроков в бой"
            @click="sendSelectedPlayersToCombat"
          >
            <LogIn :size="17" />
            <span v-if="selectedPlayersToCombat.length" class="players-action-count">{{ selectedPlayersToCombat.length }}</span>
          </button>
          <span class="live-indicator" :class="[liveStatus, syncStatus]" :title="liveStatus === 'connected' ? 'Сессия синхронизирована' : 'Восстанавливаем связь с сессией'">
            <span class="live-bar" :class="{ running: syncRunning || liveCatchingUp }" />
          </span>
          <div class="players-actions">
            <RowActionMenu>
              <template #trigger>
                <button type="button" class="players-actions-trigger" title="Действия с игроками" aria-label="Действия с игроками">
                  +
                </button>
              </template>
              <template #default="{ close }">
                <RowActionItem action="join" @click="openJoinOwn(); close()">Присоединить своего персонажа</RowActionItem>
                <RowActionItem action="create" @click="openCreate(); close()">Создать персонажа</RowActionItem>
                <RowActionItem action="copy" @click="copyCode(); close()">Скопировать код приглашения</RowActionItem>
                <RowActionItem action="copy-link" @click="copyLink(); close()">Скопировать ссылку приглашения</RowActionItem>
              </template>
            </RowActionMenu>
          </div>
          <button
            type="button"
            class="players-rail-toggle"
            :class="{ 'players-rail-toggle--error': kickError || colorError || participantOrderError }"
            :title="playersRailMode === 'compact' ? 'Развернуть игроков' : 'Свернуть игроков'"
            :aria-label="playersRailMode === 'compact' ? 'Развернуть игроков' : 'Свернуть игроков'"
            :aria-expanded="playersRailMode !== 'compact'"
            :disabled="playersRailMode === 'combat'"
            @click="togglePlayersRail"
          >
            <PanelLeftOpen v-if="playersRailMode === 'compact'" :size="15" />
            <PanelLeftClose v-else :size="15" />
          </button>
        </div>

        <div v-if="participants.length" class="participants-list" data-sortable-container="participants">
          <SessionParticipantCard
            v-for="(p, participantIndex) in displayedParticipants"
            :key="p.charId"
            :data-sortable-key="p.charId"
            :participant="p"
            :is-dm="isDm"
            :kick-pending="kickingIds.has(p.charId)"
            :color-pending="coloringIds.has(p.charId)"
            :reorder-enabled="isDm && participants.length > 1 && !participantOrderSaving"
            :reorder-placeholder="participantSortable.isSource(p)"
            :should-suppress-reorder-click="participantSortable.shouldSuppressClick"
            :compact="playersRailMode === 'compact'"
            :combat-mode="playersRailMode === 'combat'"
            :combatant="encounterPlayer(p.charId)"
            :combat-selected="isEncounterPlayerSelected(p.charId)"
            :combat-current="isEncounterPlayerCurrent(p.charId)"
            :combat-editable="isDm"
            @view="openParticipant"
            @color="setParticipantColor"
            @kick="requestKickParticipant"
            @revive="encounter.requestRevive(encounterPlayer(p.charId))"
            @drag-start="startParticipantDrag($event, p, participantIndex)"
            @update:combat-selected="setEncounterPlayerSelected(p.charId, $event)"
            @update:initiative="setEncounterPlayerInitiative(p.charId, $event)"
          />
        </div>
        <div v-else class="no-participants">Участников пока нет</div>
        <div v-if="kickError || colorError || participantOrderError" class="participant-action-error" role="alert">
          {{ kickError || colorError || participantOrderError }}
        </div>
      </aside>

      <CharacterSheetModal
        v-if="sheetUuid"
        :uuid="sheetUuid"
        :is-dm="isDm"
        @close="sheetUuid = null"
      />

      <CharacterCreateWizardModal
        v-if="createOpen"
        ref="createModalRef"
        :creating="creating"
        :error="createError"
        @close="closeCreate"
        @create="createChar"
      />

      <SessionJoinModal
        v-if="joinOwnOpen"
        :session-uuid="sessionUuid"
        :session-name="session.name"
        title="Присоединить своего персонажа"
        :redirect-on-join="false"
        @close="joinOwnOpen = false"
        @joined="handleOwnCharacterJoined"
      />
    </div>
  </div>
</template>

<script setup>
import PageTutorial from '@/features/tutorials/components/PageTutorial.vue'
import { LoadingState } from '@sylvieshare/share-ui'
import { ListChecks, LogIn, PanelLeftClose, PanelLeftOpen } from '@lucide/vue'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import CharacterCreateWizardModal from '@/features/character-list/components/CharacterCreateWizardModal.vue'
import CharacterSheetModal from '@/features/character-editor/components/CharacterSheetModal.vue'
import ChapterGraphTab from '@/features/sessions/components/ChapterGraphTab.vue'
import EncounterReviveModal from '@/features/sessions/components/EncounterReviveModal.vue'
import SessionChronicleWorkspace from '@/features/sessions/components/SessionChronicleWorkspace.vue'
import SessionEditModal from '@/features/sessions/components/SessionEditModal.vue'
import SessionJoinModal from '@/features/sessions/components/SessionJoinModal.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import SessionCenterWorkspace from '@/features/sessions/components/SessionCenterWorkspace.vue'
import SessionParticipantCard from '@/features/sessions/components/SessionParticipantCard'
import SessionPlayerView from '@/features/sessions/components/SessionPlayerView.vue'
import SessionShortcutHelp from '@/features/sessions/components/SessionShortcutHelp.vue'
import SessionTimerStack from '@/features/sessions/components/SessionTimerStack.vue'
import SessionMusicWorkspace from '@/features/sessions/components/SessionMusicWorkspace.vue'
import JournalWorkspace from '@/features/journals/components/JournalWorkspace.vue'
import SessionWorldLayer from '@/features/sessions/components/SessionWorldLayer.vue'
import { useSessionPage } from '../composables/useSessionPage'

const {
  allEncounterPlayersSelected, applySessionEdit, chapterGraph, chapterGraphTab, closeCreate,
  colorError, coloringIds, combatWorkspace, combatWorkspaceError, confirmKickParticipant,
  copyCode, copyLink, createChar, createError, createModalRef,
  createOpen, creating, currentChapter, displayedParticipants, editOpen,
  encounter, encounterPlayer, encounterPlayers, handleOwnCharacterJoined, importCombatBlock,
  isDm, isEncounterPlayerCurrent, isEncounterPlayerSelected, joinOwnOpen, kickError,
  kickingIds, liveCatchingUp, liveStatus, loading, myCharUuid,
  openChapterScenes, openChapters, openCombatTab, openCreate, openEdit,
  openJoinOwn, openParticipant, openRelatedScene, participantOrderError, participantOrderSaving,
  participantSortable, participants, pendingKick, pendingKickName, playersRailMode,
  presentation, primaryView, requestKickParticipant, selectLocation, selectMaterial,
  selectNpc, selectQuest, selectSessionView, selectedLocationId, selectedMaterialId,
  selectedNpcId, selectedPlayersToCombat, selectedQuestId, sendBlockToCombat, sendSelectedPlayersToCombat,
  session, sessionMaterials, sessionSettings, sessionTimers, sessionTutorial,
  sessionUuid, sessionWorld, setEncounterPlayerInitiative, setEncounterPlayerSelected, setParticipantColor,
  sheetUuid, shortcutLabels, showShortcutHints, startParticipantDrag, syncRunning,
  syncStatus, toggleAllEncounterPlayers, togglePlayersRail, tutorialMobile, tutorialRoot,
  updateSessionSetting, updateWorkspaceContext, workspaceChapter, workspaceClosing, workspaceLevel,
  workspaceMode, workspaceMotionMode, workspaceScene, worldLayer,
} = useSessionPage()
</script>

<style scoped src="./styles/ViewSession.css"></style>
